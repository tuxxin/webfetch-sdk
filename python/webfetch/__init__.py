"""Official Python client for the webfetch.io scraping API."""

from .client import (
    WebfetchClient,
    AsyncWebfetchClient,
    WebfetchResult,
    WebfetchError,
    WebfetchApiError,
    WebfetchRateLimitError,
)

__all__ = [
    "WebfetchClient",
    "AsyncWebfetchClient",
    "WebfetchResult",
    "WebfetchError",
    "WebfetchApiError",
    "WebfetchRateLimitError",
]
__version__ = "1.0.0"
