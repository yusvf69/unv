import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

function getConnectionUrl(): string {
  const url = process.env.DATABASE_URL || "";
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("postgresql://") ? url : url.replace("postgres://", "postgresql://"));
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch { return url; }
}

function getSql() {
  if (!_sql) {
    const connectionUrl = getConnectionUrl();
    if (!connectionUrl) throw new Error("DATABASE_URL is not set");
    _sql = neon(connectionUrl);
  }
  return _sql;
}

export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  try { const result = await getSql()(strings, ...values); return Array.isArray(result) ? result : []; }
  catch (e: any) { console.error("🔴 [sql] Error:", e?.message, e?.stack); return []; }
}
