from __future__ import annotations
import re
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union
import jsonata
if TYPE_CHECKING:
    from app.core.data_context import DataContext


class JsonataTransformationError(Exception):
    """Exception raised when JSONata transformation fails."""
    pass


class JsonataAdapter:
    """
    JSONata Transformation & Data Fusion Adapter.
    Executes JSONata expressions with custom variable bindings ($globals, $steps, $inputs)
    and automatic syntax normalization.
    """

    @classmethod
    def normalize_expression(cls, expression: str) -> str:
        """
        Normalize JSONata expression.
        In JSONata syntax, '=' is the comparison operator. Many developers write '=='
        which causes a syntax error. We replace '==' with '=' outside string literals.
        """
        # Split expression into string literals and non-string chunks
        pattern = re.compile(r'("[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\'|[^\'"\\]+)')
        chunks: List[str] = []

        for match in pattern.finditer(expression):
            chunk = match.group(0)
            if chunk.startswith('"') or chunk.startswith("'"):
                chunks.append(chunk)
            else:
                # Replace == with = ensuring we do not touch !=, <=, >=
                chunk = re.sub(r"(?<![=!<>])==(?![=])", "=", chunk)
                chunks.append(chunk)

        return "".join(chunks)

    @classmethod
    def _flatten_result(cls, result: Any) -> Any:
        """
        Flatten nested lists that JSONata `.[{...}]` constructs can produce,
        e.g., [[{...}], [{...}]] -> [{...}, {...}].
        """
        if isinstance(result, list):
            # If it is a list of single-item lists of dicts
            if all(isinstance(item, list) and len(item) == 1 and isinstance(item[0], dict) for item in result):
                return [item[0] for item in result]
            # If it's a single item not wrapped
            return result
        elif isinstance(result, dict):
            return [result]
        return result

    @classmethod
    def transform(
        cls,
        expression: str,
        context: Union[DataContext, Dict[str, Any]],
        extra_bindings: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        Evaluate a JSONata expression against the given DataContext.
        """
        if hasattr(context, "to_dict") and hasattr(context, "globals"):
            context_dict = context.to_dict()
            globals_dict = context.globals
            inputs_dict = context.inputs
            steps_dict = context.steps
        else:
            context_dict = context
            globals_dict = context.get("globals", {})
            inputs_dict = context.get("inputs", {})
            steps_dict = context.get("steps", {})

        normalized_expr = cls.normalize_expression(expression.strip())

        try:
            compiled = jsonata.Jsonata(normalized_expr)

            # Assign system variables for direct $variable access in expressions
            compiled.assign("globals", globals_dict)
            compiled.assign("inputs", inputs_dict)
            compiled.assign("steps", steps_dict)
            if "execution_id" in context_dict:
                compiled.assign("execution_id", context_dict["execution_id"])

            if extra_bindings:
                for k, v in extra_bindings.items():
                    compiled.assign(k, v)

            raw_result = compiled.evaluate(context_dict)
            return cls._flatten_result(raw_result)

        except Exception as e:
            raise JsonataTransformationError(
                f"Failed to evaluate JSONata expression: {str(e)}\nExpression was:\n{normalized_expr}"
            ) from e


def transform_jsonata(
    expression: str,
    context: Union[DataContext, Dict[str, Any]],
    extra_bindings: Optional[Dict[str, Any]] = None,
) -> Any:
    """Convenience helper to evaluate JSONata expression."""
    return JsonataAdapter.transform(expression, context, extra_bindings=extra_bindings)
