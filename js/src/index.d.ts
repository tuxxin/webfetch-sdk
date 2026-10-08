export declare class WebfetchError extends Error {}

export declare class WebfetchApiError extends WebfetchError {
  status: number;
  code: string | null;
  body: string;
}

export declare class WebfetchRateLimitError extends WebfetchApiError {
  retryAfter: number | null;
}

export interface FetchOptions {
  renderJs?: boolean;
  wait?: number;
  waitFor?: string;
  waitBrowser?: 'domcontentloaded' | 'load' | 'networkidle0' | 'networkidle2';
  jsScenario?: object;
  windowWidth?: number;
  windowHeight?: number;
  premiumProxy?: boolean;
  stealthProxy?: boolean;
  countryCode?: string;
  ownProxy?: string;
  sessionId?: number;
  blockResources?: boolean;
  blockAds?: boolean;
  extractRules?: object;
  returnPageSource?: boolean;
  returnPageText?: boolean;
  returnPageMarkdown?: boolean;
  jsonResponse?: boolean;
  screenshot?: boolean;
  screenshotFullPage?: boolean;
  screenshotSelector?: string;
  cookies?: string;
  device?: 'desktop' | 'mobile';
  timeout?: number;
  transparentStatusCode?: boolean;
  tag?: string;
  respectRobots?: boolean;
  /** ScrapingBee Auto-Mode: try routes cheapest first, bill only the one that worked. */
  mode?: 'auto';
  /** Credit ceiling for one mode=auto call. */
  maxCost?: number;
  /** Sent to the target with a Wf- prefix, stripped downstream. */
  headers?: Record<string, string>;
  /** Any other documented parameter, in the API's own snake_case. */
  [param: string]: unknown;
}

export declare class WebfetchResult {
  content: string;
  credits: number;
  status: number;
  resolvedUrl: string;
  headers: Record<string, string>;
  proxyPool: string | null;
  proxyDowngraded: boolean;
  screenshotUrl: string | null;
  tag: string | null;
  json<T = unknown>(): T;
  toString(): string;
}

export interface Usage {
  plan: string;
  max_api_credit: number;
  used_api_credit: number;
  max_concurrency: number;
  current_concurrency: number;
  renewal_subscription_date: string;
}

export declare class WebfetchClient {
  constructor(apiKey?: string | null, options?: { baseUrl?: string; timeout?: number });
  fetch(url: string, options?: FetchOptions): Promise<WebfetchResult>;
  markdown(url: string, options?: FetchOptions): Promise<string>;
  extract<T = unknown>(url: string, rules: object, options?: FetchOptions): Promise<T>;
  usage(): Promise<Usage>;
}

export default WebfetchClient;
