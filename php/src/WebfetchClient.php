<?php
declare(strict_types=1);

namespace Tuxxin\Webfetch;

/**
 * Official PHP client for the webfetch.io scraping and search API.
 *
 * Uses the cURL extension directly, so there is no HTTP-client dependency to
 * conflict with whatever the host application already has.
 *
 * The API is ScrapingBee-compatible: option names are the documented parameter
 * names, so nothing is translated on the way out.
 */
final class WebfetchClient
{
    private const JSON_PARAMS = ['extract_rules', 'js_scenario'];

    /** The search endpoints. */
    public const SEARCH_ENGINES = ['google', 'bing', 'yahoo'];

    private string $baseUrl;

    /**
     * @param array<int,mixed> $curlOptions Extra cURL options, merged last. The
     *        usual reason to pass anything here is a development origin with a
     *        self-signed certificate, where CURLOPT_SSL_VERIFYPEER => false is
     *        appropriate. Do not disable verification against production.
     */
    public function __construct(
        private readonly ?string $apiKey = null,
        string $baseUrl = 'https://api.webfetch.io/v1/',
        private readonly int $timeout = 180,
        private readonly array $curlOptions = []
    ) {
        $this->baseUrl = rtrim($baseUrl, '/') . '/';
    }

    /**
     * Fetch a URL.
     *
     * @param array<string,mixed> $options Documented API parameters. 'headers'
     *                                     is special: those are forwarded to the
     *                                     target with a Wf- prefix.
     */
    public function fetch(string $url, array $options = []): WebfetchResult
    {
        if (trim($url) === '') {
            throw new WebfetchError('url is required');
        }

        $forward = $options['headers'] ?? [];
        unset($options['headers']);
        $params  = self::params(['url' => $url], $options);
        $headers = [];
        foreach ($forward as $name => $value) {
            // The Wf- prefix is stripped before the header reaches the target.
            $headers[]                 = 'Wf-' . $name . ': ' . $value;
            $params['forward_headers'] = 'true';
        }
        return $this->request('', $params, $headers, $url);
    }

    /**
     * One page of ranked results from google, bing or yahoo, in the shape of
     * ScrapingBee's Google Search API; the result's json() is the response.
     *
     * Needs a paid plan with the robots.txt opt-out turned on for the key.
     * 10 credits, or 15 with 'light_request' => false.
     *
     * @param array<string,mixed> $options country_code, language, page, light_request,
     *        search_type ('classic' or 'ads'), add_html, tag, nfpr, extra_params
     */
    public function search(string $engine, string $query, array $options = []): WebfetchResult
    {
        if (!in_array($engine, self::SEARCH_ENGINES, true)) {
            throw new WebfetchError('engine must be one of ' . implode(', ', self::SEARCH_ENGINES));
        }
        if (trim($query) === '') {
            throw new WebfetchError('query is required');
        }
        unset($options['headers']);
        return $this->request($engine, self::params(['search' => $query], $options), [], null);
    }

    /** A Google search, as the decoded response. */
    public function google(string $query, array $options = []): array
    {
        return $this->search('google', $query, $options)->json();
    }

    /** A Bing search, as the decoded response. */
    public function bing(string $query, array $options = []): array
    {
        return $this->search('bing', $query, $options)->json();
    }

    /** A Yahoo search, as the decoded response. */
    public function yahoo(string $query, array $options = []): array
    {
        return $this->search('yahoo', $query, $options)->json();
    }

    /** @param array<string,mixed> $options */
    private static function params(array $first, array $options): array
    {
        $params = $first;
        foreach ($options as $key => $value) {
            if ($value === null) {
                continue;
            }
            if (in_array($key, self::JSON_PARAMS, true) && is_array($value)) {
                $params[$key] = json_encode($value, JSON_UNESCAPED_SLASHES);
            } elseif ($key === 'extra_params' && is_array($value)) {
                $params[$key] = http_build_query($value);
            } elseif (is_bool($value)) {
                $params[$key] = $value ? 'true' : 'false';
            } else {
                $params[$key] = (string) $value;
            }
        }
        return $params;
    }

    /** One GET to the API, with its errors mapped to the exception classes. */
    private function request(string $path, array $params, array $extraHeaders, ?string $requestedUrl): WebfetchResult
    {
        if ($this->apiKey === null || $this->apiKey === '') {
            // Fail here rather than spending a round trip on a request that
            // cannot succeed: the API has no keyless tier.
            throw new WebfetchError(
                'An API key is required. Get a free one at https://webfetch.io/signup'
            );
        }
        $headers = array_merge(['Accept: */*', 'Authorization: Bearer ' . $this->apiKey], $extraHeaders);

        $responseHeaders = [];
        $ch = curl_init($this->baseUrl . $path . '?' . http_build_query($params));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HEADERFUNCTION => function ($ch, string $line) use (&$responseHeaders): int {
                $pos = strpos($line, ':');
                if ($pos !== false) {
                    $responseHeaders[strtolower(trim(substr($line, 0, $pos)))] = trim(substr($line, $pos + 1));
                }
                return strlen($line);
            },
        ] + $this->curlOptions);

        $body   = curl_exec($ch);
        $errno  = curl_errno($ch);
        $error  = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $final  = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        curl_close($ch);

        if ($errno !== 0) {
            throw new WebfetchError($errno === CURLE_OPERATION_TIMEDOUT
                ? "The request timed out after {$this->timeout}s"
                : "The request failed: {$error}");
        }
        $body = (string) $body;

        if ($status >= 400) {
            $code    = null;
            $message = $body;
            $parsed  = json_decode($body, true);
            if (is_array($parsed)) {
                $code    = $parsed['code'] ?? null;
                $message = $parsed['error'] ?? $body;
            }
            $ra = $responseHeaders['retry-after'] ?? null;
            if ($status === 429 || ($status === 503 && $ra !== null)) {
                throw new WebfetchRateLimitError($message, $status, $code, $body,
                    $ra !== null ? (int) $ra : null);
            }
            throw new WebfetchApiError($message, $status, $code, $body);
        }

        return new WebfetchResult(
            content:         $body,
            credits:         (int) ($responseHeaders['wf-cost'] ?? 0),
            status:          (int) ($responseHeaders['wf-initial-status-code'] ?? $status),
            resolvedUrl:     $responseHeaders['wf-resolved-url'] ?? $requestedUrl ?? $final,
            headers:         $responseHeaders,
            proxyPool:       $responseHeaders['wf-proxy-pool'] ?? null,
            proxyDowngraded: ($responseHeaders['wf-proxy-downgraded'] ?? '') === 'true',
            screenshotUrl:   $responseHeaders['wf-screenshot-url'] ?? null,
            tag:             $responseHeaders['wf-tag'] ?? null,
        );
    }

    /** The page content as markdown, with the chrome stripped. */
    public function markdown(string $url, array $options = []): string
    {
        $options['return_page_markdown'] = true;
        return $this->fetch($url, $options)->content;
    }

    /** The page content as plain text. */
    public function text(string $url, array $options = []): string
    {
        $options['return_page_text'] = true;
        return $this->fetch($url, $options)->content;
    }

    /** Run extract_rules and return the decoded JSON. */
    public function extract(string $url, array $rules, array $options = []): mixed
    {
        $options['extract_rules'] = $rules;
        return $this->fetch($url, $options)->json();
    }

    /** Current credit and concurrency state. Requires a key. */
    public function usage(): array
    {
        if ($this->apiKey === null || $this->apiKey === '') {
            throw new WebfetchError('usage() requires an API key');
        }
        $ch = curl_init($this->baseUrl . 'usage');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $this->apiKey, 'Accept: application/json'],
        ] + $this->curlOptions);
        $body   = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status >= 400) {
            throw new WebfetchApiError('usage failed', $status, null, $body);
        }
        $decoded = json_decode($body, true);
        return is_array($decoded) ? $decoded : [];
    }
}
