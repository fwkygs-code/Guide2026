import { URLMatchingRule } from '../types';

export class URLUtils {
  static parseURL(url: string): URL {
    return new URL(url, window.location.href);
  }
  
  static matchesRule(url: string, rule: URLMatchingRule): boolean {
    const urlObj = new URL(url);
    
    // Exact match
    if (rule.exact && urlObj.href !== rule.exact) {
      return false;
    }
    
    // Pattern matching (glob patterns)
    if (rule.pattern && !this.matchPattern(urlObj.href, rule.pattern)) {
      return false;
    }
    
    // Regular expression matching
    if (rule.regex && !new RegExp(rule.regex).test(urlObj.href)) {
      return false;
    }
    
    // Path matching
    if (rule.path && !this.matchPath(urlObj.pathname, rule.path)) {
      return false;
    }
    
    // Query parameter matching
    if (rule.query && !this.matchQuery(urlObj.searchParams, rule.query)) {
      return false;
    }
    
    // Hash matching
    if (rule.hash && !this.matchHash(urlObj.hash, rule.hash)) {
      return false;
    }
    
    // Domain matching
    if (rule.domain && !this.matchDomain(urlObj.hostname, rule.domain)) {
      return false;
    }
    
    return true;
  }
  
  private static matchPattern(url: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');
    
    return new RegExp(`^${regexPattern}$`).test(url);
  }
  
  private static matchPath(pathname: string, pathRule: any): boolean {
    if (pathRule.exact && pathname !== pathRule.exact) {
      return false;
    }
    
    if (pathRule.startsWith && !pathname.startsWith(pathRule.startsWith)) {
      return false;
    }
    
    if (pathRule.endsWith && !pathname.endsWith(pathRule.endsWith)) {
      return false;
    }
    
    if (pathRule.includes && !pathname.includes(pathRule.includes)) {
      return false;
    }
    
    return true;
  }
  
  private static matchQuery(searchParams: URLSearchParams, queryRule: { [key: string]: string | string[] | undefined }): boolean {
    for (const [key, expectedValue] of Object.entries(queryRule)) {
      const actualValue = searchParams.get(key);
      
      if (Array.isArray(expectedValue)) {
        if (!actualValue || !expectedValue.includes(actualValue)) {
          return false;
        }
      } else {
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  private static matchHash(hash: string, hashRule: any): boolean {
    // Remove # from hash if present
    const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
    
    if (hashRule.exact && cleanHash !== hashRule.exact) {
      return false;
    }
    
    if (hashRule.startsWith && !cleanHash.startsWith(hashRule.startsWith)) {
      return false;
    }
    
    if (hashRule.includes && !cleanHash.includes(hashRule.includes)) {
      return false;
    }
    
    return true;
  }
  
  private static matchDomain(hostname: string, domainRule: any): boolean {
    if (domainRule.exact && hostname !== domainRule.exact) {
      return false;
    }
    
    if (domainRule.includes && !hostname.includes(domainRule.includes)) {
      return false;
    }
    
    return true;
  }
  
  static isSameOrigin(url1: string, url2: string): boolean {
    try {
      const urlObj1 = new URL(url1);
      const urlObj2 = new URL(url2);
      
      return urlObj1.origin === urlObj2.origin;
    } catch (error) {
      return false;
    }
  }
  
  static getRelativePath(url: string): string {
    const urlObj = new URL(url, window.location.href);
    return urlObj.pathname + urlObj.search + urlObj.hash;
  }
  
  static getCurrentURL(): string {
    return window.location.href;
  }
  
  static getCurrentPath(): string {
    return window.location.pathname;
  }
  
  static getCurrentDomain(): string {
    return window.location.hostname;
  }
  
  static getCurrentOrigin(): string {
    return window.location.origin;
  }
  
  static buildURL(base: string, path: string, query?: Record<string, string>, hash?: string): string {
    const url = new URL(path, base);
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    if (hash) {
      url.hash = hash.startsWith('#') ? hash : `#${hash}`;
    }
    
    return url.href;
  }
  
  static getURLChanges(oldURL: string, newURL: string): {
    originChanged: boolean;
    pathChanged: boolean;
    queryChanged: boolean;
    hashChanged: boolean;
    domainChanged: boolean;
  } {
    try {
      const old = new URL(oldURL);
      const newUrl = new URL(newURL);
      
      return {
        originChanged: old.origin !== newUrl.origin,
        pathChanged: old.pathname !== newUrl.pathname,
        queryChanged: old.search !== newUrl.search,
        hashChanged: old.hash !== newUrl.hash,
        domainChanged: old.hostname !== newUrl.hostname
      };
    } catch (error) {
      return {
        originChanged: true,
        pathChanged: true,
        queryChanged: true,
        hashChanged: true,
        domainChanged: true
      };
    }
  }
  
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  static sanitizeURL(url: string): string {
    try {
      const urlObj = new URL(url, window.location.href);
      return urlObj.href;
    } catch (error) {
      return window.location.href;
    }
  }
  
  static getURLParameter(name: string): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
  
  static setURLParameter(name: string, value: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.replaceState({}, '', url.href);
  }
  
  static removeURLParameter(name: string): void {
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    window.history.replaceState({}, '', url.href);
  }
  
  static getURLHash(): string {
    return window.location.hash;
  }
  
  static setURLHash(hash: string): void {
    const cleanHash = hash.startsWith('#') ? hash : `#${hash}`;
    window.history.replaceState({}, '', cleanHash);
  }
  
  static removeURLHash(): void {
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }
}
