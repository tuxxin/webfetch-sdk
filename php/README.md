# tuxxin/webfetch

Official PHP client for the [webfetch.io](https://webfetch.io) scraping API.
PHP 8.1+, cURL directly, no Guzzle dependency.

```bash
composer require tuxxin/webfetch
```

## Use

```php
use Tuxxin\Webfetch\WebfetchClient;

$client = new WebfetchClient('wfk_...');   // required; free key at webfetch.io/signup

$md = $client->markdown('https://example.com');

$data = $client->extract('https://quotes.toscrape.com/js/', [
    'quotes' => [
        'selector' => '.quote',
        'type'     => 'list',
        'output'   => ['text' => '.text', 'author' => '.author'],
    ],
]);

$result = $client->fetch('https://example.com', [
    'render_js' => false,      // 1 credit instead of 5
    'block_ads' => true,
]);
echo $result->status, ' ', $result->credits, ' ', $result->resolvedUrl;
```

## A development origin

Against a local origin with a self-signed certificate, pass cURL options through
the fourth constructor argument. Do not do this against production.

```php
$client = new WebfetchClient('wfk_...', 'https://localhost:1115/api/v1/', 180, [
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);
```

## Search

```php
$results = $client->bing('python asyncio tutorial', ['country_code' => 'us']);
foreach ($results['organic_results'] as $r) {
    echo $r['position'], ' ', $r['title'], ' ', $r['url'], "\n";
}

$ads = $client->search('yahoo', 'car insurance quotes', ['search_type' => 'ads']);
echo $ads->credits, count($ads->json()['top_ads']);
```

`bing()`, `yahoo()` and `google()` return the decoded response; `search($engine, $query)`
returns the result object, with `credits` and `json()`.
Needs a paid plan with the robots.txt opt-out turned on for the key in the
[key portal](https://webfetch.io/key): every engine's robots.txt disallows its
result pages. Bing and Yahoo are open; Google answers `503 engine_unavailable`
until it opens. 10 credits a page, 15 with `light_request` false; a failed
search costs nothing. Reference: <https://webfetch.io/documentation#search>.

## Errors

```php
use Tuxxin\Webfetch\{WebfetchApiError, WebfetchRateLimitError};

try {
    $client->fetch($url);
} catch (WebfetchRateLimitError $e) {
    sleep($e->retryAfter ?? 5);
} catch (WebfetchApiError $e) {
    error_log("$e->status $e->errorCode");  // errorCode is stable and safe to branch on
}
```

A failed call is never billed.

## Credits

`render_js` defaults to **true**, which costs 5 credits. Pass
`'render_js' => false` for a plain HTTP fetch at 1 credit. `$result->credits`
reports what was charged.

MIT licensed. Full reference at <https://webfetch.io/documentation>.
