export class ObjectUrlRegistry {
  private readonly urls = new Map<string, string>();
  private readonly createUrl: (blob: Blob) => string;
  private readonly revokeUrl: (url: string) => void;

  constructor(createUrl: (blob: Blob) => string, revokeUrl: (url: string) => void) {
    this.createUrl = createUrl;
    this.revokeUrl = revokeUrl;
  }

  has(id: string): boolean {
    return this.urls.has(id);
  }

  register(id: string, blob: Blob): string {
    const current = this.urls.get(id);
    if (current) return current;
    const url = this.createUrl(blob);
    this.urls.set(id, url);
    return url;
  }

  remove(id: string): void {
    const url = this.urls.get(id);
    if (!url) return;
    this.revokeUrl(url);
    this.urls.delete(id);
  }

  reconcile(ids: ReadonlySet<string>): void {
    for (const id of this.urls.keys()) {
      if (!ids.has(id)) this.remove(id);
    }
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.urls);
  }

  dispose(): void {
    for (const id of [...this.urls.keys()]) this.remove(id);
  }
}
