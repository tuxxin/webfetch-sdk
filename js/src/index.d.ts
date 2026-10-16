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

export interface SearchOptions {
  /** Two-letter country the search runs from. Default us. */
  countryCode?: string;
  /** Interface language, such as de. Default en. Bing and Google. */
  language?: string;
  /** Results page, 1 to 50. */
  page?: number;
  /** true (default): 10 credits. false: 15, loaded in a browser (on Bing, with the ads). */
  lightRequest?: boolean;
  /** classic (default), or ads for the ads only. */
  searchType?: 'classic' | 'ads';
  /** Also return the page HTML, in html. */
  addHtml?: boolean;
  tag?: string;
  /** Google only. Turn off spelling auto-correction. */
  nfpr?: boolean;
  /** Google only. Extra Google URL parameters, from ScrapingBee's allow-list. */
  extraParams?: Record<string, string> | string;
  [param: string]: unknown;
}

export interface SearchOrganicResult {
  position: number;
  title: string;
  url: string;
  displayed_url: string | null;
  description: string | null;
  domain: string | null;
  date: string | null;
  date_utc: string | null;
  rich_snippet: object;
  sitelinks: { title: string; url: string }[];
}

export interface SearchAd {
  position: number;
  title: string;
  /** The landing page. */
  url: string | null;
  /** The engine's click URL. */
  tracking_url: string | null;
  visual_url: string | null;
  domain: string | null;
  description: string | null;
  snippet: string | null;
  sitelinks: { title: string; url: string }[];
}

export interface SearchResponse {
  meta_data: {
    url: string;
    number_of_results: number | null;
    location: string | null;
    number_of_organic_results: number;
    number_of_ads: number;
    number_of_page: number;
    zero_results_for_original_query: boolean;
  };
  organic_results: SearchOrganicResult[];
  top_ads: SearchAd[];
  bottom_ads: SearchAd[];
  related_queries: { position: number; title: string; url: string }[];
  related_searches: { position: number; query: string; link: string; type: string }[];
  questions: { position: number; text: string; answer: string | null }[];
  knowledge_graph: object;
  local_results: unknown[];
  top_stories: unknown[];
  news_results: unknown[];
  images: unknown[];
  map_results: unknown[];
  hotel_results: unknown[];
  ai_overviews: unknown[];
  /** With addHtml: true. */
  html?: string;
}

export declare const SEARCH_ENGINES: readonly ['google', 'bing', 'yahoo'];

export declare class WebfetchClient {
  constructor(apiKey?: string | null, options?: { baseUrl?: string; timeout?: number });
  fetch(url: string, options?: FetchOptions): Promise<WebfetchResult>;
  markdown(url: string, options?: FetchOptions): Promise<string>;
  extract<T = unknown>(url: string, rules: object, options?: FetchOptions): Promise<T>;
  /** One page of ranked results. Needs a paid plan with the robots.txt opt-out on. */
  search(engine: 'google' | 'bing' | 'yahoo', query: string, options?: SearchOptions): Promise<WebfetchResult>;
  google(query: string, options?: SearchOptions): Promise<SearchResponse>;
  bing(query: string, options?: SearchOptions): Promise<SearchResponse>;
  yahoo(query: string, options?: SearchOptions): Promise<SearchResponse>;
  usage(): Promise<Usage>;
}

export default WebfetchClient;
