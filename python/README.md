# webfetch-io

Official Python client for the [webfetch.io](https://webfetch.io) scraping API.
Python 3.9+, sync and async, one dependency (`httpx`).

```bash
pip install webfetch-io
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

## Search

```python
results = client.bing("python asyncio tutorial", country_code="us")
for r in results["organic_results"]:
    print(r["position"], r["title"], r["url"])

ads = client.search("yahoo", "car insurance quotes", search_type="ads")
print(ads.credits, ads.json()["top_ads"])
```

`bing()`, `yahoo()` and `google()` return the parsed response; `search(engine, query)`
returns the result object, with `credits` and `json()`. The async client has the
same methods.
Needs a paid plan with the robots.txt opt-out turned on for the key in the
[key portal](https://webfetch.io/key): every engine's robots.txt disallows its
result pages. Bing and Yahoo are open; Google answers `503 engine_unavailable`
until it opens. 10 credits a page, 15 with `light_request` false; a failed
search costs nothing. Reference: <https://webfetch.io/documentation#search>.

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
