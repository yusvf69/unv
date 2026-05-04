import { neon } from "@neondatabase/serverless";

console.log("🟢 [db] Module loaded");

const DATABASE_URL = process.env.DATABASE_URL;
console.log("🟡 [db] DATABASE_URL set:", !!DATABASE_URL);

if (!DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL is not set - database queries will fail");
}

let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    console.log("🔵 [db] Initializing neon connection...");
    _sql = neon(DATABASE_URL);
    console.log("🟢 [db] neon initialized");
  }
  return _sql;
}

export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  console.log("🔵 [db] Query starting...");
  const result = await getSql()(strings, ...values);
  console.log("🟢 [db] Query complete, rows:", Array.isArray(result) ? result.length : "not array");
  return Array.isArray(result) ? result : [];
}
