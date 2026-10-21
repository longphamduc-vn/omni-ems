from __future__ import annotations
import asyncio
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, Union
import httpx
from jinja2 import Environment, FileSystemLoader, BaseLoader, select_autoescape

from app.config import settings
if TYPE_CHECKING:
    from app.core.data_context import DataContext
from app.adapters.nexacro_parser import NexacroParser, NexacroError


class HttpAuthRequiredError(Exception):
    """Raised when HTTP 401/403 or auth expiration occurs, triggering self-healing."""
    def __init__(self, message: str, status_code: int = 401, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class HttpAdapter:
    """
    Async HTTP Adapter Layer managing persistent connections,
    Jinja2 XML payload compilation, and Single vs Loop concurrency modes.
    """

    def __init__(
        self,
        templates_dir: Optional[Union[str, Path]] = None,
        client: Optional[httpx.AsyncClient] = None,
    ):
        self.templates_dir = Path(templates_dir or settings.TEMPLATES_DIR)
        self.templates_dir.mkdir(parents=True, exist_ok=True)

        # File-based Jinja2 Environment
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

        # String-based Jinja2 Environment for inline templates and header expressions
        self.inline_jinja_env = Environment(
            loader=BaseLoader(),
            trim_blocks=True,
            lstrip_blocks=True,
        )

        # Shared httpx.AsyncClient with connection pooling
        self._external_client = client is not None
        self._client: Optional[httpx.AsyncClient] = client
        self._client_loop: Optional[asyncio.AbstractEventLoop] = None

    async def get_client(self) -> httpx.AsyncClient:
        """Return the active AsyncClient instance bound to the current running event loop."""
        current_loop = asyncio.get_running_loop()
        if (
            self._client is None
            or self._client.is_closed
            or self._client_loop is None
            or self._client_loop != current_loop
            or self._client_loop.is_closed()
        ):
            self._client_loop = current_loop
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(settings.HTTP_TIMEOUT_SECONDS),
                limits=httpx.Limits(
                    max_keepalive_connections=settings.HTTP_MAX_KEEPALIVE_CONNECTIONS,
                    max_connections=settings.HTTP_MAX_CONNECTIONS,
                ),
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        """Gracefully close HTTP client connection pool."""
        if not self._external_client and not self._client.is_closed:
            await self._client.aclose()

    # ==========================================
    # Dynamic Payload Builder (Jinja2)
    # ==========================================

    def render_template(
        self,
        template_file: Optional[str],
        template_inline: Optional[str],
        context: Dict[str, Any]
    ) -> str:
        """Render template either from filesystem or inline string."""
        if template_file:
            template = self.jinja_env.get_template(template_file)
            return template.render(context)
        elif template_inline:
            template = self.inline_jinja_env.from_string(template_inline)
            return template.render(context)
        else:
            raise ValueError("Either 'template_file' or 'template_inline' must be provided in config.")

    def render_headers_and_url(
        self,
        endpoint: str,
        headers_config: Optional[Dict[str, str]],
        context: Dict[str, Any]
    ) -> Tuple[str, Dict[str, str]]:
        """Evaluate Jinja expressions in endpoint URL and HTTP headers."""
        # Render endpoint URL if it contains Jinja syntax
        rendered_url = self.inline_jinja_env.from_string(endpoint).render(context).strip()

        # If URL is a relative path, prefix with LEGACY_EMS_BASE_URL
        if rendered_url.startswith("/"):
            base = settings.LEGACY_EMS_BASE_URL.rstrip("/")
            rendered_url = f"{base}{rendered_url}"

        # Render headers
        rendered_headers: Dict[str, str] = {}
        if headers_config:
            for key, val in headers_config.items():
                if isinstance(val, str) and ("{{" in val or "{%" in val):
                    rendered_headers[key] = self.inline_jinja_env.from_string(val).render(context).strip()
                else:
                    rendered_headers[key] = str(val)

        return rendered_url, rendered_headers

    # ==========================================
    # HTTP Execution: Single & Loop Modes
    # ==========================================

    async def execute(
        self,
        config: Dict[str, Any],
        data_context: DataContext,
    ) -> Dict[str, Any]:
        """
        Execute HTTP request step according to configuration.
        Supports mode: 'single' (batch) and 'loop'.
        """
        mode = config.get("mode", "single").lower()
        if mode == "single":
            return await self._execute_single(config, data_context)
        elif mode == "loop":
            return await self._execute_loop(config, data_context)
        else:
            raise ValueError(f"Unsupported http_request mode: '{mode}'. Must be 'single' or 'loop'.")

    async def _execute_single(
        self,
        config: Dict[str, Any],
        data_context: DataContext,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute a single HTTP request (Single/Batch Mode)."""
        template_context = data_context.to_template_context()
        if extra_context:
            template_context.update(extra_context)

        # 1. Render payload XML
        payload = self.render_template(
            template_file=config.get("template_file"),
            template_inline=config.get("template_inline"),
            context=template_context,
        )

        # 2. Render endpoint & headers
        endpoint = config.get("endpoint", "")
        headers_config = config.get("headers", {})
        url, headers = self.render_headers_and_url(endpoint, headers_config, template_context)

        # 3. Dispatch Async HTTP Request
        method = config.get("method", "POST").upper()
        client = await self.get_client()

        try:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=payload.encode("utf-8") if isinstance(payload, str) else payload,
            )
        except httpx.RequestError as exc:
            raise RuntimeError(f"HTTP request to {url} failed: {str(exc)}") from exc

        # 4. Handle HTTP auth errors (401/403)
        if response.status_code in (401, 403):
            raise HttpAuthRequiredError(
                f"Legacy endpoint returned HTTP {response.status_code} Unauthorized",
                status_code=response.status_code,
                details={"status_code": response.status_code, "url": url}
            )

        # 5. Parse response according to protocol
        protocol = config.get("protocol", "nexacro_xml").lower()
        response_text = response.text

        if protocol == "nexacro_xml":
            parsed = NexacroParser.parse_nexacro_response(response_text)
            metadata = parsed["metadata"]
            error_code = metadata.get("error_code", 0)
            error_msg = metadata.get("error_msg", "")

            # Check for negative ErrorCode (session expired / auth failure in Nexacro protocol)
            if error_code < 0:
                # If message indicates session/auth expiration, flag as HttpAuthRequiredError
                lower_msg = str(error_msg).lower()
                if "session" in lower_msg or "auth" in lower_msg or "login" in lower_msg or "expired" in lower_msg or error_code == -1:
                    raise HttpAuthRequiredError(
                        f"Nexacro session invalid or expired: ErrorCode {error_code} - {error_msg}",
                        status_code=401,
                        details={"error_code": error_code, "error_msg": error_msg}
                    )
                raise NexacroError(error_code=error_code, error_msg=error_msg, metadata=metadata)

            return parsed
        else:
            # JSON or raw text response
            try:
                data = response.json()
                return {"metadata": {"status_code": response.status_code}, "raw_flattened": data if isinstance(data, list) else [data]}
            except Exception:
                return {"metadata": {"status_code": response.status_code}, "raw_flattened": [], "raw_text": response_text}

    async def _execute_loop(
        self,
        config: Dict[str, Any],
        data_context: DataContext,
    ) -> Dict[str, Any]:
        """
        Execute multiple HTTP requests concurrently (Loop Mode).
        Uses asyncio.gather bounded by an asyncio.Semaphore(max_concurrency).
        """
        loop_over_expr = config.get("loop_over")
        if not loop_over_expr:
            raise ValueError("'loop_over' path must be specified when mode is 'loop' (e.g. 'inputs.items').")

        # Resolve items to loop over
        items = data_context.resolve_path(loop_over_expr, default=[])
        if not isinstance(items, (list, tuple)):
            items = [items] if items else []

        if not items:
            return {
                "metadata": {"error_code": 0, "error_msg": "SUCCESS", "total_count": 0, "loop_count": 0},
                "raw_flattened": [],
                "datasets": {},
            }

        max_concurrency = int(config.get("max_concurrency", settings.DEFAULT_MAX_CONCURRENCY))
        semaphore = asyncio.Semaphore(max_concurrency)

        async def worker(index: int, item: Any) -> Dict[str, Any]:
            async with semaphore:
                extra_ctx = {
                    "item": item,
                    "loop": {
                        "index": index,
                        "index0": index,
                        "first": index == 0,
                        "last": index == len(items) - 1,
                        "length": len(items),
                    }
                }
                return await self._execute_single(config, data_context, extra_context=extra_ctx)

        # Dispatch all concurrent requests bounded by semaphore
        tasks = [worker(idx, item) for idx, item in enumerate(items)]
        results = await asyncio.gather(*tasks)

        # Merge results into combined raw_flattened and datasets
        all_flattened: List[Dict[str, Any]] = []
        combined_datasets: Dict[str, List[Dict[str, Any]]] = {}

        for res in results:
            if "raw_flattened" in res and isinstance(res["raw_flattened"], list):
                all_flattened.extend(res["raw_flattened"])
            if "datasets" in res and isinstance(res["datasets"], dict):
                for ds_id, rows in res["datasets"].items():
                    if ds_id not in combined_datasets:
                        combined_datasets[ds_id] = []
                    combined_datasets[ds_id].extend(rows)

        metadata = {
            "error_code": 0,
            "error_msg": "SUCCESS",
            "total_count": len(all_flattened),
            "loop_count": len(items),
        }

        return {
            "metadata": metadata,
            "raw_flattened": all_flattened,
            "datasets": combined_datasets,
        }


# Singleton instance
http_adapter = HttpAdapter()
