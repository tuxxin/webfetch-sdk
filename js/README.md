# @tuxxin/webfetch

Official JavaScript client for the [webfetch.io](https://webfetch.io) scraping API.
Node 18+, no runtime dependencies, ESM and CommonJS, TypeScript types included.

```bash
npm install @tuxxin/webfetch
```

## Use

```js
import { WebfetchClient } from '@tuxxin/webfetch';

const client = new WebfetchClient(process.env.WEBFETCH_KEY);

// A rendered page as markdown
const md = await client.markdown('https://example.com');

// Structured extraction
const data = await client.extract('https://quotes.toscrape.com/js/', {
  quotes: {
    selector: '.quote',
    type: 'list',
    output: { text: '.text', author: '.author' },
  },
});

// Full control
const result = await client.fetch('https://example.com', {
  renderJs: false,          // 1 credit instead of 5
  blockAds: true,
  waitBrowser: 'networkidle2',
});
console.log(result.status, result.credits, result.resolvedUrl);
```

A key is required. A [free account](https://webfetch.io/signup) starts with 1,000
credits and gets 250 more each month (banking up to 1,000), and needs only a
confirmed email address.

## Search

```js
const results = await client.bing('python asyncio tutorial', { countryCode: 'us' });
for (const r of results.organic_results) console.log(r.position, r.title, r.url);

const ads = await client.search('yahoo', 'car insurance quotes', { searchType: 'ads' });
console.log(ads.credits, ads.json().top_ads);
```

`google()`, `bing()`, `yahoo()` and `brave()` return the parsed response; `search(engine, query)`
returns the result object, with `credits` and `json()`.
Needs a paid plan with the robots.txt opt-out turned on for the key in the
[key portal](https://webfetch.io/key): every engine's robots.txt disallows its
result pages. Google, Bing, Yahoo and Brave are all open. 10 credits a page, 15 with `light_request` false; a failed
search costs nothing. Reference: <https://webfetch.io/documentation#search>.

## Errors

```js
import { WebfetchRateLimitError, WebfetchApiError } from '@tuxxin/webfetch';

try {
  await client.fetch(url);
} catch (e) {
  if (e instanceof WebfetchRateLimitError) {
    await new Promise(r => setTimeout(r, (e.retryAfter ?? 5) * 1000));
  } else if (e instanceof WebfetchApiError) {
    console.error(e.status, e.code, e.message);   // e.code is stable
  }
}
```

A failed call is never billed, so there is nothing to reconcile afterwards.

## Credits

`renderJs` defaults to **true**, which costs 5 credits. Pass `renderJs: false`
for a plain HTTP fetch at 1 credit. `result.credits` reports what was charged.

MIT licensed. Full reference at <https://webfetch.io/documentation>.
