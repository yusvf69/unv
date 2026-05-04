import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    _sql = neon(DATABASE_URL);
  }
  return _sql;
}

export const sql = new Proxy((() => {}) as unknown as ReturnType<typeof neon>, {
  apply(_, __, args: [TemplateStringsArray, ...any[]]) {
    return (getSql() as any)(...args);
  },
  get(_, prop) {
    return (getSql() as any)[prop];
  },
}) as unknown as ReturnType<typeof neon>;
