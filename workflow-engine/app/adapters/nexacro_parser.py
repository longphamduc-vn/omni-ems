import re
import html
from typing import Any, Dict, List, Optional, Tuple, Union
import xmltodict


class NexacroError(Exception):
    """Exception raised when Nexacro returns a negative ErrorCode."""

    def __init__(self, error_code: int, error_msg: str, metadata: Optional[Dict[str, Any]] = None):
        super().__init__(f"Nexacro API Error [Code {error_code}]: {error_msg}")
        self.error_code = error_code
        self.error_msg = error_msg
        self.metadata = metadata or {}


class NexacroParser:
    """
    Parser for Nexacro XML / Dataset protocol.
    Extracts control parameters (ErrorCode/ErrorMsg), metadata, and flattens
    nested <Dataset><Rows><Row><Col> elements into an Array of Objects.
    """

    @staticmethod
    def unescape(val: Optional[str]) -> str:
        """Unescape XML entities."""
        if not val:
            return ""
        return html.unescape(val.strip())

    @classmethod
    def parse_parameters(cls, xml_str: str) -> Dict[str, Any]:
        """Extract all <Parameter id="...">value</Parameter> tags."""
        params: Dict[str, Any] = {}
        # Matches both <Parameter id="foo">bar</Parameter> and <Parameter id="foo" />
        param_pattern = re.compile(r'<Parameter\s+id="([^"]+)"(?:[^>]*>([\s\S]*?)<\/Parameter>|\s*\/>)', re.IGNORECASE)
        for match in param_pattern.finditer(xml_str):
            pid = match.group(1)
            raw_val = match.group(2)
            val = cls.unescape(raw_val) if raw_val is not None else ""
            params[pid] = val

        return params

    @classmethod
    def parse_datasets(cls, xml_str: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract all <Dataset id="..."> datasets and flatten rows."""
        datasets: Dict[str, List[Dict[str, Any]]] = {}

        # Match each Dataset block
        ds_pattern = re.compile(r'<Dataset\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/Dataset>', re.IGNORECASE)
        row_pattern = re.compile(r'<Row[^>]*>([\s\S]*?)<\/Row>', re.IGNORECASE)
        col_pattern = re.compile(r'<Col\s+id="([^"]+)"(?:>([\s\S]*?)<\/Col>|\s*\/>)', re.IGNORECASE)

        for ds_match in ds_pattern.finditer(xml_str):
            ds_id = ds_match.group(1)
            ds_body = ds_match.group(2)

            rows: List[Dict[str, Any]] = []
            for row_match in row_pattern.finditer(ds_body):
                row_body = row_match.group(1)
                row_dict: Dict[str, Any] = {}
                for col_match in col_pattern.finditer(row_body):
                    col_id = col_match.group(1)
                    raw_col_val = col_match.group(2)
                    col_val = cls.unescape(raw_col_val) if raw_col_val is not None else ""
                    row_dict[col_id] = col_val
                rows.append(row_dict)

            datasets[ds_id] = rows

        return datasets

    @classmethod
    def parse_nexacro_response(
        cls,
        response_text: str,
        raise_on_error: bool = False
    ) -> Dict[str, Any]:
        """
        Parse raw Nexacro XML response string into normalized dictionary.
        Returns:
            {
                "metadata": {
                    "error_code": 0 or 1,
                    "error_msg": "SUCCESS",
                    "total_count": 150,
                    ...
                },
                "raw_flattened": [ ... ],
                "datasets": { ... }
            }
        """
        clean_xml = response_text.replace("\r", "")
        params = cls.parse_parameters(clean_xml)
        datasets = cls.parse_datasets(clean_xml)

        # Extract ErrorCode and ErrorMsg
        raw_error_code = params.get("errorCode") or params.get("ErrorCode") or params.get("error_code")
        error_code = 0
        if raw_error_code is not None and str(raw_error_code).strip() != "":
            try:
                error_code = int(str(raw_error_code).strip())
            except ValueError:
                error_code = 0

        error_msg = (
            params.get("errorMsg")
            or params.get("ErrorMsg")
            or params.get("error_msg")
            or ("SUCCESS" if error_code >= 0 else "ERROR")
        )

        # Primary dataset / flattened rows
        raw_flattened: List[Dict[str, Any]] = []
        if datasets:
            # Check for standard result dataset names
            for candidate in ("ds_result", "ds_list", "ds_List", "ds_Item", "ds_StockInfomation", "ds_Rtn", "ds_output0"):
                if candidate in datasets:
                    raw_flattened = datasets[candidate]
                    break
            if not raw_flattened:
                # If none of the known names matched, take the first dataset
                first_key = next(iter(datasets))
                raw_flattened = datasets[first_key]

        # Extract TotalCount metadata
        total_count = None
        raw_total_count = params.get("TotalCount") or params.get("totalCount") or params.get("total_count")
        if raw_total_count is not None and str(raw_total_count).strip() != "":
            try:
                total_count = int(str(raw_total_count).strip())
            except ValueError:
                total_count = len(raw_flattened)
        else:
            total_count = len(raw_flattened)

        metadata = {
            "error_code": error_code,
            "error_msg": error_msg,
            "total_count": total_count,
            **params,
        }

        if raise_on_error and error_code < 0:
            raise NexacroError(error_code=error_code, error_msg=error_msg, metadata=metadata)

        return {
            "metadata": metadata,
            "raw_flattened": raw_flattened,
            "datasets": datasets,
        }


# Convenience function
def parse_nexacro_response(response_text: str, raise_on_error: bool = False) -> Dict[str, Any]:
    return NexacroParser.parse_nexacro_response(response_text, raise_on_error=raise_on_error)
