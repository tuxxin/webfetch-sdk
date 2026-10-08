<?php
declare(strict_types=1);

namespace Tuxxin\Webfetch;

/** The API answered with an error status. Never billed. */
class WebfetchApiError extends WebfetchError
{
    public function __construct(
        string $message,
        public readonly int $status,
        /**
         * A stable machine-readable code, worth branching on.
         *
         * Named errorCode rather than code because \Exception already declares a
         * non-readonly int $code, and redeclaring it as a readonly string is a
         * fatal error. The inherited $code carries the HTTP status, as usual.
         */
        public readonly ?string $errorCode = null,
        public readonly string $body = ''
    ) {
        parent::__construct($message, $status);
    }
}
