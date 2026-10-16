"""
Sync and async clients for the webfetch.io scraping and search API.

The API is ScrapingBee-compatible, so parameter names, defaults and credit costs
match. Keyword arguments are accepted in Python's snake_case, which is also the
wire format, so nothing is translated.
"""

from __future__ import annotations

import json as _json
from typing import Any, Dict, Mapping, Optional
from urllib.parse import urlencode as _urlencode

import httpx

DEFAULT_BASE_URL = "https://api.webfetch.io/v1/"
DEFAULT_TIMEOUT = 180.0

# Sent as stringified JSON rather than as a nested query structure.
_JSON_PARAMS = ("extract_rules", "js_scenario")

#: The search endpoints. Google answers 503 engine_unavailable until it opens.
SEARCH_ENGINES = ("google", "bing", "yahoo")


class WebfetchError(Exception):
    """Anything went wrong."""


class WebfetchApiError(WebfetchError):
    """The API answered with an error status. Never billed."""

    def __init__(self, message: str, status: int, code: Optional[str] = None, body: str = ""):
        super().__init__(message)
        self.status = status
        #: A stable machine-readable code, worth branching on.
        self.code = code
        self.body = body


class WebfetchRateLimitError(WebfetchApiError):
    """429 (the per-minute rate or the concurrency cap), or 503 with Retry-After
    (free capacity is busy, code free_tier_busy). Neither is billed; wait and retry."""

    def __init__(self, message: str, status: int, code=None, body: str = "",
                 retry_after: Optional[int] = None):
        super().__init__(message, status, code, body)
        #: Seconds to wait, from Retry-After. None if the header was absent.
        self.retry_after = retry_after


class WebfetchResult:
    """A successful call."""

    __slots__ = ("content", "credits", "status", "resolved_url", "headers",
                 "proxy_pool", "proxy_downgraded", "screenshot_url", "tag")

    def __init__(self, response: httpx.Response, requested_url: str):
        h = response.headers
        self.content: str = response.text
        #: Credits actually charged, from Wf-Cost.
        self.credits: int = int(h.get("Wf-Cost", 0) or 0)
        #: The status the target returned, from Wf-Initial-Status-Code.
        self.status: int = int(h.get("Wf-Initial-Status-Code", response.status_code) or 0)
        self.resolved_url: str = h.get("Wf-Resolved-Url") or requested_url
        self.headers: Dict[str, str] = dict(h)
        self.proxy_pool: Optional[str] = h.get("Wf-Proxy-Pool")
        #: True when the requested proxy pool was unavailable and another pool served it.
        #: ``credits`` says what was charged.
        self.proxy_downgraded: bool = h.get("Wf-Proxy-Downgraded") == "true"
        self.screenshot_url: Optional[str] = h.get("Wf-Screenshot-Url")
        self.tag: Optional[str] = h.get("Wf-Tag")

    def json(self) -> Any:
        """Parse the body as JSON. Useful with extract_rules or json_response."""
        try:
            return _json.loads(self.content)
        except ValueError as exc:
            raise WebfetchError(f"The response body is not JSON: {exc}") from exc

    def __str__(self) -> str:
        return self.content

    def __repr__(self) -> str:
        return (f"<WebfetchResult status={self.status} credits={self.credits} "
                f"bytes={len(self.content)} url={self.resolved_url!r}>")


def _params(first: Dict[str, str], options: Mapping[str, Any]) -> Dict[str, str]:
    params = dict(first)
    for key, value in options.items():
        if value is None or key == "headers":
            continue
        if key in _JSON_PARAMS and isinstance(value, (dict, list)):
            params[key] = _json.dumps(value, separators=(",", ":"))
        elif key == "extra_params" and isinstance(value, Mapping):
            params[key] = _urlencode(value)
        elif isinstance(value, bool):
            params[key] = "true" if value else "false"
        else:
            params[key] = str(value)
    return params


def _build(url: str, options: Mapping[str, Any]) -> Dict[str, str]:
    if not url or not isinstance(url, str):
        raise WebfetchError("url is required and must be a string")
    return _params({"url": url}, options)


def _build_search(engine: str, query: str, options: Mapping[str, Any]) -> Dict[str, str]:
    if engine not in SEARCH_ENGINES:
        raise WebfetchError("engine must be one of " + ", ".join(SEARCH_ENGINES))
    if not query or not isinstance(query, str):
        raise WebfetchError("query is required and must be a string")
    return _params({"search": query}, options)


def _headers(api_key: Optional[str], options: Mapping[str, Any]) -> Dict[str, str]:
    # Fail here rather than spending a round trip on a request that cannot
    # succeed: the API has no keyless tier.
    if not api_key:
        raise WebfetchError(
            "An API key is required. Get a free one at https://webfetch.io/signup"
        )
    out = {"Accept": "*/*", "Authorization": f"Bearer {api_key}"}
    # Forwarded headers carry a Wf- prefix, stripped before they reach the target.
    for k, v in (options.get("headers") or {}).items():
        out[f"Wf-{k}"] = str(v)
    return out


def _raise_for_error(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    body = response.text
    code = None
    message = body
    try:
        parsed = _json.loads(body)
        code = parsed.get("code")
        message = parsed.get("error", body)
    except ValueError:
        pass
    ra = response.headers.get("Retry-After")
    if response.status_code == 429 or (response.status_code == 503 and ra):
        raise WebfetchRateLimitError(message, response.status_code, code, body,
                                     int(ra) if ra and ra.isdigit() else None)
    raise WebfetchApiError(message, response.status_code, code, body)


class WebfetchClient:
    """Synchronous client.

    >>> client = WebfetchClient("wfk_...")
    >>> result = client.fetch("https://example.com", render_js=False)
    >>> result.credits
    1
    """

    def __init__(self, api_key: Optional[str] = None, *,
                 base_url: str = DEFAULT_BASE_URL, timeout: float = DEFAULT_TIMEOUT,
                 client: Optional[httpx.Client] = None):
        self.api_key = api_key
        self.base_url = base_url if base_url.endswith("/") else base_url + "/"
        self.timeout = timeout
        self._client = client or httpx.Client(timeout=timeout, follow_redirects=False)
        self._owns_client = client is None

    def fetch(self, url: str, **options: Any) -> WebfetchResult:
        """Fetch a URL. Keyword arguments are the documented API parameters."""
        params = _build(url, options)
        if options.get("headers"):
            params["forward_headers"] = "true"
        try:
            response = self._client.get(self.base_url, params=params,
                                        headers=_headers(self.api_key, options))
        except httpx.TimeoutException as exc:
            raise WebfetchError(f"The request timed out after {self.timeout}s") from exc
        except httpx.HTTPError as exc:
            raise WebfetchError(f"The request failed: {exc}") from exc
        _raise_for_error(response)
        return WebfetchResult(response, url)

    def markdown(self, url: str, **options: Any) -> str:
        """The page content as markdown, with the chrome stripped."""
        options["return_page_markdown"] = True
        return self.fetch(url, **options).content

    def text(self, url: str, **options: Any) -> str:
        """The page content as plain text."""
        options["return_page_text"] = True
        return self.fetch(url, **options).content

    def extract(self, url: str, rules: Mapping[str, Any], **options: Any) -> Any:
        """Run extract_rules and return the parsed JSON."""
        options["extract_rules"] = dict(rules)
        return self.fetch(url, **options).json()

    def search(self, engine: str, query: str, **options: Any) -> WebfetchResult:
        """One page of ranked results from ``google``, ``bing`` or ``yahoo``, in the
        shape of ScrapingBee's Google Search API; ``.json()`` is the response.

        Keyword arguments: country_code, language, page, light_request,
        search_type ("classic" or "ads"), add_html, tag, nfpr, extra_params.
        Needs a paid plan with the robots.txt opt-out turned on for the key.
        10 credits, or 15 with light_request=False.
        """
        params = _build_search(engine, query, options)
        try:
            response = self._client.get(self.base_url + engine, params=params,
                                        headers=_headers(self.api_key, {}))
        except httpx.TimeoutException as exc:
            raise WebfetchError(f"The request timed out after {self.timeout}s") from exc
        except httpx.HTTPError as exc:
            raise WebfetchError(f"The request failed: {exc}") from exc
        _raise_for_error(response)
        return WebfetchResult(response, str(response.url))

    def google(self, query: str, **options: Any) -> Dict[str, Any]:
        """A Google search, as the parsed response."""
        return self.search("google", query, **options).json()

    def bing(self, query: str, **options: Any) -> Dict[str, Any]:
        """A Bing search, as the parsed response."""
        return self.search("bing", query, **options).json()

    def yahoo(self, query: str, **options: Any) -> Dict[str, Any]:
        """A Yahoo search, as the parsed response."""
        return self.search("yahoo", query, **options).json()

    def usage(self) -> Dict[str, Any]:
        """Current credit and concurrency state. Requires a key."""
        if not self.api_key:
            raise WebfetchError("usage() requires an API key")
        response = self._client.get(self.base_url + "usage",
                                    headers={"Authorization": f"Bearer {self.api_key}"})
        _raise_for_error(response)
        return response.json()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "WebfetchClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


class AsyncWebfetchClient:
    """Asynchronous client. The same surface, awaited.

    >>> async with AsyncWebfetchClient("wfk_...") as client:
    ...     result = await client.fetch("https://example.com", render_js=False)
    """

    def __init__(self, api_key: Optional[str] = None, *,
                 base_url: str = DEFAULT_BASE_URL, timeout: float = DEFAULT_TIMEOUT,
                 client: Optional[httpx.AsyncClient] = None):
        self.api_key = api_key
        self.base_url = base_url if base_url.endswith("/") else base_url + "/"
        self.timeout = timeout
        self._client = client or httpx.AsyncClient(timeout=timeout, follow_redirects=False)
        self._owns_client = client is None

    async def fetch(self, url: str, **options: Any) -> WebfetchResult:
        params = _build(url, options)
        if options.get("headers"):
            params["forward_headers"] = "true"
        try:
            response = await self._client.get(self.base_url, params=params,
                                              headers=_headers(self.api_key, options))
        except httpx.TimeoutException as exc:
            raise WebfetchError(f"The request timed out after {self.timeout}s") from exc
        except httpx.HTTPError as exc:
            raise WebfetchError(f"The request failed: {exc}") from exc
        _raise_for_error(response)
        return WebfetchResult(response, url)

    async def markdown(self, url: str, **options: Any) -> str:
        options["return_page_markdown"] = True
        return (await self.fetch(url, **options)).content

    async def text(self, url: str, **options: Any) -> str:
        options["return_page_text"] = True
        return (await self.fetch(url, **options)).content

    async def extract(self, url: str, rules: Mapping[str, Any], **options: Any) -> Any:
        options["extract_rules"] = dict(rules)
        return (await self.fetch(url, **options)).json()

    async def search(self, engine: str, query: str, **options: Any) -> WebfetchResult:
        params = _build_search(engine, query, options)
        try:
            response = await self._client.get(self.base_url + engine, params=params,
                                              headers=_headers(self.api_key, {}))
        except httpx.TimeoutException as exc:
            raise WebfetchError(f"The request timed out after {self.timeout}s") from exc
        except httpx.HTTPError as exc:
            raise WebfetchError(f"The request failed: {exc}") from exc
        _raise_for_error(response)
        return WebfetchResult(response, str(response.url))

    async def google(self, query: str, **options: Any) -> Dict[str, Any]:
        return (await self.search("google", query, **options)).json()

    async def bing(self, query: str, **options: Any) -> Dict[str, Any]:
        return (await self.search("bing", query, **options)).json()

    async def yahoo(self, query: str, **options: Any) -> Dict[str, Any]:
        return (await self.search("yahoo", query, **options)).json()

    async def usage(self) -> Dict[str, Any]:
        if not self.api_key:
            raise WebfetchError("usage() requires an API key")
        response = await self._client.get(self.base_url + "usage",
                                          headers={"Authorization": f"Bearer {self.api_key}"})
        _raise_for_error(response)
        return response.json()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> "AsyncWebfetchClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()
