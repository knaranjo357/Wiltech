/** Small, session-scoped cache. Failed and superseded requests are never stored. */
export class RequestCache {
  private values = new Map<string, { value: unknown; expires: number }>();
  private pending = new Map<string, Promise<unknown>>();

  clear() {
    this.values.clear();
    this.pending.clear();
  }

  async get<T>(key: string, loader: () => Promise<T>, ttl: number, force = false): Promise<T> {
    const cached = this.values.get(key);
    if (!force && cached && cached.expires > Date.now()) return cached.value as T;
    if (!force && this.pending.has(key)) return this.pending.get(key) as Promise<T>;
    this.values.delete(key);
    const request = Promise.resolve().then(loader);
    this.pending.set(key, request);
    try {
      const value = await request;
      if (this.pending.get(key) === request) {
        for (const [entry, data] of this.values) {
          if (data.expires <= Date.now()) this.values.delete(entry);
        }
        if (this.values.size >= 20) this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { value, expires: Date.now() + ttl });
      }
      return value;
    } finally {
      if (this.pending.get(key) === request) this.pending.delete(key);
    }
  }
}
