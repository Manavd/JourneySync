declare module "cloudflare:workers" {
  export const env: any;
}

declare interface Fetcher {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

declare interface D1Database {
  prepare(query: string): any;
  dump(): any;
  batch(statements: any[]): any;
  exec(query: string): any;
}
