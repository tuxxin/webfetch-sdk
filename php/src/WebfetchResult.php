<?php
declare(strict_types=1);

namespace Tuxxin\Webfetch;

/** A successful call. */
final class WebfetchResult
{
    public function __construct(
        public readonly string $content,
        /** Credits actually charged, from Wf-Cost. */
        public readonly int $credits,
        /** The status the target returned, from Wf-Initial-Status-Code. */
        public readonly int $status,
        public readonly string $resolvedUrl,
        /** @var array<string,string> */
        public readonly array $headers = [],
        public readonly ?string $proxyPool = null,
        /** True when the requested proxy pool was unavailable and another pool served it. $credits says what was charged. */
        public readonly bool $proxyDowngraded = false,
        public readonly ?string $screenshotUrl = null,
        public readonly ?string $tag = null,
    ) {}

    /** Parse the body as JSON. Useful with extract_rules or json_response. */
    public function json(bool $assoc = true): mixed
    {
        $decoded = json_decode($this->content, $assoc);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new WebfetchError('The response body is not JSON: ' . json_last_error_msg());
        }
        return $decoded;
    }

    public function __toString(): string
    {
        return $this->content;
    }
}
