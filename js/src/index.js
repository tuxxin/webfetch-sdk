/**
 * Official JavaScript client for the webfetch.io scraping and search API.
 *
 * Node 18+ and modern browsers. Uses the platform fetch, so there are no runtime
 * dependencies.
 */

export class WebfetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebfetchError';
  }
}

/** The API answered with an error status. Never billed. */
export class WebfetchApiError extends WebfetchError {
  constructor(message, status, code, body) {
    super(message);
    this.name = 'WebfetchApiError';
    this.status = status;
    /** A stable machine-readable code, worth branching on. */
    this.code = code;
    this.body = body;
  }
}

/**
 * 429 (the per-minute rate or the concurrency cap), or 503 with Retry-After
 * (free capacity is busy, code free_tier_busy). Neither is billed; wait and retry.
 */
export class WebfetchRateLimitError extends WebfetchApiError {
  constructor(message, status, code, body, retryAfter) {
    super(message, status, code, body);
    this.name = 'WebfetchRateLimitError';
    /** Seconds to wait, from the Retry-After header. Null if absent. */
    this.retryAfter = retryAfter;
  }
}

/** What a successful call returns. */
export class WebfetchResult {
  constructor({ content, credits, status, resolvedUrl, headers, proxyPool, proxyDowngraded, screenshotUrl, tag }) {
    this.content = content;
    /** Credits actually charged, from Wf-Cost. */
    this.credits = credits;
    /** The status the target returned, from Wf-Initial-Status-Code. */
    this.status = status;
    this.resolvedUrl = resolvedUrl;
    this.headers = headers;
    this.proxyPool = proxyPool;
    /** True when the requested proxy pool was unavailable and another pool served it. `credits` says what was charged. */
    this.proxyDowngraded = proxyDowngraded;
    this.screenshotUrl = screenshotUrl;
    this.tag = tag;
  }

  /** Parse the body as JSON. Useful with extractRules or jsonResponse. */
  json() {
    try {
      return JSON.parse(this.content);
    } catch (e) {
      throw new WebfetchError('The response body is not JSON: ' + e.message);
    }
  }

  toString() {
    return this.content;
  }
}

const CAMEL_TO_SNAKE = {
  renderJs: 'render_js',
  waitFor: 'wait_for',
  waitBrowser: 'wait_browser',
  jsScenario: 'js_scenario',
  windowWidth: 'window_width',
  windowHeight: 'window_height',
  premiumProxy: 'premium_proxy',
  stealthProxy: 'stealth_proxy',
  countryCode: 'country_code',
  ownProxy: 'own_proxy',
  sessionId: 'session_id',
  blockResources: 'block_resources',
  blockAds: 'block_ads',
  extractRules: 'extract_rules',
  returnPageSource: 'return_page_source',
  returnPageText: 'return_page_text',
  returnPageMarkdown: 'return_page_markdown',
  jsonResponse: 'json_response',
  screenshotFullPage: 'screenshot_full_page',
  screenshotSelector: 'screenshot_selector',
  forwardHeaders: 'forward_headers',
  forwardHeadersPure: 'forward_headers_pure',
  transparentStatusCode: 'transparent_status_code',
  respectRobots: 'respect_robots',
  maxCost: 'max_cost',
  // Search API
  lightRequest: 'light_request',
  searchType: 'search_type',
  addHtml: 'add_html',
  extraParams: 'extra_params',
  nbResults: 'nb_results',
};

/** The search endpoints. Google answers 503 engine_unavailable until it opens. */
export const SEARCH_ENGINES = ['google', 'bing', 'yahoo'];

/** Options to query parameters: camelCase or snake_case names, booleans as true/false. */
function toParams(params, options) {
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || key === 'headers') continue;
    const name = CAMEL_TO_SNAKE[key] || key;
    // extract_rules and js_scenario go over the wire as stringified JSON;
    // extra_params as a URL-encoded string.
    if ((name === 'extract_rules' || name === 'js_scenario') && typeof value === 'object') {
      params.set(name, JSON.stringify(value));
    } else if (name === 'extra_params' && typeof value === 'object') {
      params.set(name, new URLSearchParams(value).toString());
    } else if (typeof value === 'boolean') {
      params.set(name, value ? 'true' : 'false');
    } else {
      params.set(name, String(value));
    }
  }
  return params;
}

export class WebfetchClient {
  /**
   * @param {string} apiKey Required. Get one free at https://webfetch.io/signup
   * @param {{baseUrl?: string, timeout?: number}} [options]
   */
  constructor(apiKey = null, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl || 'https://api.webfetch.io/v1/').replace(/\/?$/, '/');
    this.timeout = options.timeout ?? 180000;
  }

  /**
   * Fetch a URL.
   *
   * Option names are accepted in camelCase or in the API's own snake_case, so
   * code ported from another client keeps working either way.
   *
   * @param {string} url
   * @param {object} [options]
   * @returns {Promise<WebfetchResult>}
   */
  async fetch(url, options = {}) {
    if (!url || typeof url !== 'string') {
      throw new WebfetchError('url is required and must be a string');
    }
    const params = toParams(new URLSearchParams({ url }), options);
    const headers = {};
    // Forwarded headers are prefixed Wf-, and the prefix is stripped downstream.
    for (const [k, v] of Object.entries(options.headers || {})) {
      headers[`Wf-${k}`] = String(v);
      params.set('forward_headers', 'true');
    }
    return this._request('', params, headers, url);
  }

  /**
   * Search Google, Bing or Yahoo and get one page of ranked results as JSON,
   * in the shape of ScrapingBee's Google Search API. The result's json() is
   * the response: organic_results, top_ads, bottom_ads, related_searches, ...
   *
   * Needs a paid plan with the robots.txt opt-out turned on for the key.
   * 10 credits, or 15 with lightRequest: false.
   *
   * @param {'google'|'bing'|'yahoo'} engine
   * @param {string} query
   * @param {object} [options] countryCode, language, page, lightRequest, searchType ('classic' or 'ads'), ...
   * @returns {Promise<WebfetchResult>}
   */
  async search(engine, query, options = {}) {
    if (!SEARCH_ENGINES.includes(engine)) {
      throw new WebfetchError(`engine must be one of ${SEARCH_ENGINES.join(', ')}`);
    }
    if (!query || typeof query !== 'string') {
      throw new WebfetchError('query is required and must be a string');
    }
    return this._request(engine, toParams(new URLSearchParams({ search: query }), options), {}, null);
  }

  /** Convenience: a Google search, as the parsed response JSON. */
  async google(query, options = {}) {
    return (await this.search('google', query, options)).json();
  }

  /** Convenience: a Bing search, as the parsed response JSON. */
  async bing(query, options = {}) {
    return (await this.search('bing', query, options)).json();
  }

  /** Convenience: a Yahoo search, as the parsed response JSON. */
  async yahoo(query, options = {}) {
    return (await this.search('yahoo', query, options)).json();
  }

  /** One GET to the API, with its errors mapped to the exception classes. */
  async _request(path, params, extraHeaders, requestedUrl) {
    if (!this.apiKey) {
      // Fail here rather than spending a round trip on a request that cannot
      // succeed: the API has no keyless tier.
      throw new WebfetchError(
        'An API key is required. Get a free one at https://webfetch.io/signup'
      );
    }
    const headers = { Accept: '*/*', Authorization: `Bearer ${this.apiKey}`, ...extraHeaders };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}${path}?${params.toString()}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new WebfetchError(`The request timed out after ${this.timeout} ms`);
      }
      throw new WebfetchError(`The request failed: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }

    const body = await response.text();
    const h = response.headers;

    if (!response.ok) {
      let code = null;
      let message = body;
      try {
        const parsed = JSON.parse(body);
        code = parsed.code ?? null;
        message = parsed.error ?? body;
      } catch { /* the body was not JSON */ }

      const ra = h.get('Retry-After');
      if (response.status === 429 || (response.status === 503 && ra)) {
        const secs = Number(ra);
        throw new WebfetchRateLimitError(message, response.status, code, body,
          ra && Number.isFinite(secs) ? secs : null);
      }
      throw new WebfetchApiError(message, response.status, code, body);
    }

    return new WebfetchResult({
      content: body,
      credits: Number(h.get('Wf-Cost') ?? 0),
      status: Number(h.get('Wf-Initial-Status-Code') ?? response.status),
      resolvedUrl: h.get('Wf-Resolved-Url') || requestedUrl,
      headers: Object.fromEntries(h.entries()),
      proxyPool: h.get('Wf-Proxy-Pool'),
      proxyDowngraded: h.get('Wf-Proxy-Downgraded') === 'true',
      screenshotUrl: h.get('Wf-Screenshot-Url'),
      tag: h.get('Wf-Tag'),
    });
  }

  /** Convenience: return the page as markdown. */
  async markdown(url, options = {}) {
    const r = await this.fetch(url, { ...options, returnPageMarkdown: true });
    return r.content;
  }

  /** Convenience: run extract_rules and return the parsed JSON. */
  async extract(url, rules, options = {}) {
    const r = await this.fetch(url, { ...options, extractRules: rules });
    return r.json();
  }

  /** Current credit and concurrency state. Requires a key. */
  async usage() {
    if (!this.apiKey) throw new WebfetchError('usage() requires an API key');
    const res = await globalThis.fetch(`${this.baseUrl}usage`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new WebfetchApiError('usage failed', res.status, null, await res.text());
    }
    return res.json();
  }
}

export default WebfetchClient;
