"""Official Python client for the webfetch.io scraping and search API."""

from .client import (
    WebfetchClient,
    AsyncWebfetchClient,
    WebfetchResult,
    WebfetchError,
    WebfetchApiError,
    WebfetchRateLimitError,
    SEARCH_ENGINES,
)

__all__ = [
    "WebfetchClient",
    "AsyncWebfetchClient",
    "WebfetchResult",
    "WebfetchError",
    "WebfetchApiError",
    "WebfetchRateLimitError",
    "SEARCH_ENGINES",
]
__version__ = "1.1.1"
