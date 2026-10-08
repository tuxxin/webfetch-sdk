# webfetch

Official Python client for the [webfetch.io](https://webfetch.io) scraping API.
Python 3.9+, sync and async, one dependency (`httpx`).

```bash
pip install webfetch
```

## Use

```python
from webfetch import WebfetchClient

client = WebfetchClient("wfk_...")          # required; free key at webfetch.io/signup

md = client.markdown("https://example.com")

data = client.extract("https://quotes.toscrape.com/js/", {
    "quotes": {
        "selector": ".quote",
        "type": "list",
        "output": {"text": ".text", "author": ".author"},
    },
})

result = client.fetch("https://example.com", render_js=False, block_ads=True)
print(result.status, result.credits, result.resolved_url)
```

Async is the same surface, awaited:

```python
from webfetch import AsyncWebfetchClient

async with AsyncWebfetchClient("wfk_...") as client:
    result = await client.fetch("https://example.com", render_js=False)
```

## Errors

```python
from webfetch import WebfetchApiError, WebfetchRateLimitError

try:
    client.fetch(url)
except WebfetchRateLimitError as e:
    time.sleep(e.retry_after or 5)
except WebfetchApiError as e:
    print(e.status, e.code)      # e.code is stable and safe to branch on
```

A failed call is never billed.

## Credits

`render_js` defaults to **True**, which costs 5 credits. Pass `render_js=False`
for a plain HTTP fetch at 1 credit. `result.credits` reports what was charged.

MIT licensed. Full reference at <https://webfetch.io/documentation>.
