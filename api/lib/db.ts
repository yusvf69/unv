import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw Object.assign(
        new Error("DATABASE_URL environment variable is not set"),
        { status: 500 }
      );
    }
    _sql = neon(url);
  }
  return _sql;
}

export const sql = new Proxy((() => {}) as any, {
  apply(_: any, __: any, args: any[]) {
    return (getSql() as any)(...args);
  },
  get(_: any, prop: string) {
    return (getSql() as any)[prop];
  },
}) as (...args: any[]) => Promise<any[]>;
