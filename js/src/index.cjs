/** CommonJS entry point. The implementation lives in index.js as ESM. */
'use strict';

let mod = null;
async function load() {
  if (!mod) mod = await import('./index.js');
  return mod;
}

class WebfetchClient {
  constructor(apiKey = null, options = {}) {
    this._args = [apiKey, options];
    this._inner = null;
  }
  async _client() {
    if (!this._inner) {
      const m = await load();
      this._inner = new m.WebfetchClient(...this._args);
    }
    return this._inner;
  }
  async fetch(url, options = {})            { return (await this._client()).fetch(url, options); }
  async markdown(url, options = {})         { return (await this._client()).markdown(url, options); }
  async extract(url, rules, options = {})   { return (await this._client()).extract(url, rules, options); }
  async search(engine, query, options = {}) { return (await this._client()).search(engine, query, options); }
  async google(query, options = {})         { return (await this._client()).google(query, options); }
  async bing(query, options = {})           { return (await this._client()).bing(query, options); }
  async yahoo(query, options = {})          { return (await this._client()).yahoo(query, options); }
  async brave(query, options = {})          { return (await this._client()).brave(query, options); }
  async usage()                             { return (await this._client()).usage(); }
}

module.exports = WebfetchClient;
module.exports.WebfetchClient = WebfetchClient;
module.exports.SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'brave'];
module.exports.errors = async () => {
  const m = await load();
  return {
    WebfetchError: m.WebfetchError,
    WebfetchApiError: m.WebfetchApiError,
    WebfetchRateLimitError: m.WebfetchRateLimitError,
  };
};
