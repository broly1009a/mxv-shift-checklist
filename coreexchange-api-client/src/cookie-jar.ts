/**
 * cookie-jar.ts
 * Quản lý Cookie Jar chuẩn HTTP & Session Cookie cho Core Exchange
 */

export class CookieJar {
  private cookies = new Map<string, string>();

  constructor(initialCookies?: string) {
    if (initialCookies) {
      this.setFromCookieString(initialCookies);
    }
  }

  /**
   * Trích xuất cookie từ response headers
   */
  public setFromHeaders(headers: Headers | any): void {
    let raw: string[] = [];
    if (typeof headers.getSetCookie === 'function') {
      raw = headers.getSetCookie();
    } else if (headers.raw && typeof headers.raw === 'function') {
      raw = headers.raw()['set-cookie'] || [];
    } else if (typeof headers.get === 'function') {
      const single = headers.get('set-cookie');
      if (single) raw = [single];
    }

    raw.forEach((str) => {
      const parts = str.split(';');
      const [nameVal] = parts;
      const eqIdx = nameVal.indexOf('=');
      if (eqIdx > 0) {
        const k = nameVal.substring(0, eqIdx).trim();
        const v = nameVal.substring(eqIdx + 1).trim();
        this.cookies.set(k, v);
      }
    });
  }

  /**
   * Đọc chuỗi cookie dạng "k1=v1; k2=v2"
   */
  public setFromCookieString(cookieString: string): void {
    if (!cookieString) return;
    const items = cookieString.split(';');
    for (const item of items) {
      const eqIdx = item.indexOf('=');
      if (eqIdx > 0) {
        const k = item.substring(0, eqIdx).trim();
        const v = item.substring(eqIdx + 1).trim();
        if (k) this.cookies.set(k, v);
      }
    }
  }

  public get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public set(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  /**
   * Trích xuất duy nhất SESSION cookie của Core Exchange
   */
  public getSessionCookie(): string {
    const session = this.cookies.get('SESSION');
    return session ? `SESSION=${session}` : this.getCookieHeader();
  }

  public toObject(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [k, v] of this.cookies.entries()) {
      obj[k] = v;
    }
    return obj;
  }
}
