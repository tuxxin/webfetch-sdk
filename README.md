# Webfetch SDKs

Official clients for the [webfetch.io](https://webfetch.io) scraping and search
API, in JavaScript, Python and PHP. MIT licensed.

Each one wraps `GET https://api.webfetch.io/v1/` and the search endpoints
(`/v1/google`, `/v1/bing`, `/v1/yahoo`, `/v1/brave`). The API is ScrapingBee-compatible, so
parameter names, defaults and credit costs match.

| Language | Install | Requires |
|---|---|---|
| JavaScript | `npm install @tuxxin/webfetch` | Node 18+, no runtime dependencies |
| Python | `pip install webfetch-io` (imports as `webfetch`) | Python 3.9+, `httpx` |
| PHP | `composer require tuxxin/webfetch` | PHP 8.1+, ext-curl |

## The shape is the same in all three

```
client = Webfetch(api_key)
result = client.fetch(url, render_js=True, ...)

result.content     the page, as bytes or a string
result.credits     what this call cost, from the Wf-Cost header
result.status      the status the target returned
result.resolved_url  where it ended up after redirects
```

## Search

```
results = client.bing("python asyncio tutorial", country_code="us")
results["organic_results"]   [{position, title, url, displayed_url, description, ...}]
results["top_ads"]           [{position, title, url, tracking_url, domain, ...}]

client.search("yahoo", query, search_type="ads")   the ads only, same price
```

The response has the shape of ScrapingBee's Google Search API.
Needs a paid plan with the robots.txt opt-out turned on for the key in the
[key portal](https://webfetch.io/key): every engine's robots.txt disallows its
result pages. Google, Bing, Yahoo and Brave are all open. 10 credits a page, 15 with `light_request` false; a failed
search costs nothing. Reference: <https://webfetch.io/documentation#search>.

## Credits

| Request | Credits |
|---|---|
| No JavaScript rendering | 1 |
| JavaScript rendering (the default) | 5 |
| Premium proxy | 10, or 25 with rendering |
| Stealth proxy | 75 |
| Search, light request (the default) | 10 |
| Search, `light_request` false | 15 |
| Any failed request | 0 |

`mode=auto` tries those routes cheapest first and charges only the one that
worked; `max_cost` caps it. An anti-bot challenge or CAPTCHA page is never
charged.

`render_js` defaults to true, so a call that does not set it costs 5 credits.
Pass `render_js=false` for a plain HTTP fetch at 1 credit.

## A key is required

There is no keyless tier. A [free account](https://webfetch.io/signup) starts with
1,000 credits and gets 250 more each month (banking up to 1,000), and needs only a
confirmed email address. Each client
raises `WebfetchError` immediately when constructed without a key, rather than
spending a round trip on a request that cannot succeed.

## Errors

Every SDK raises the same three-level hierarchy, so you can catch broadly or
narrowly:

```
WebfetchError            anything went wrong
  WebfetchApiError       the API answered with an error status; carries .status and .code
    WebfetchRateLimitError   429, or 503 when free capacity is busy; carries .retry_after
```

A failed call is never billed, so you do not need to reconcile credits after an
error.

## Documentation

<https://webfetch.io/documentation>
