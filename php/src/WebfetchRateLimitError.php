<?php
declare(strict_types=1);

namespace Tuxxin\Webfetch;

/**
 * 429 (the per-minute rate or the concurrency cap), or 503 with Retry-After
 * (free capacity is busy, code free_tier_busy). Neither is billed; wait and retry.
 */
class WebfetchRateLimitError extends WebfetchApiError
{
    public function __construct(
        string $message,
        int $status,
        ?string $errorCode = null,
        string $body = '',
        /** Seconds to wait, from Retry-After. Null if the header was absent. */
        public readonly ?int $retryAfter = null
    ) {
        parent::__construct($message, $status, $errorCode, $body);
    }
}
