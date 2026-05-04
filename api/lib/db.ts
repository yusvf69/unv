import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    _sql = neon(DATABASE_URL, { 
      fetch: (input: RequestInfo | URL, init?: RequestInit) => 
        fetch(input, { ...init, signal: AbortSignal.timeout(5000) })
    });
  }
  return _sql;
}

export const sql = new Proxy(() => {}, {
  apply(_, __, args) {
    return getSql()(...args);
  },
  get(_, prop) {
    return getSql()[prop as keyof typeof _sql];
  },
}) as (...args: any[]) => Promise<any[]>;
