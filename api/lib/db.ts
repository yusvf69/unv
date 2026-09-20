import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

function getConnectionUrl(): string {
  const url = process.env.DATABASE_URL || process.env.unvst_DATABASE_URL || process.env.unvst_POSTGRES_URL || "";
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("postgresql://") ? url : url.replace("postgres://", "postgresql://"));
    u.searchParams.delete("channel_binding");
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch { return url; }
}

function getSql() {
  if (!_sql) {
    const connectionUrl = getConnectionUrl();
    if (!connectionUrl) throw new Error("DATABASE_URL is not set");
    try { _sql = neon(connectionUrl); } catch (e: any) { console.error("🔴 [db] neon init failed:", e?.message); throw e; }
  }
  return _sql;
}

export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  try { const result = await getSql()(strings, ...values); return Array.isArray(result) ? result : []; }
  catch (e: any) { console.error("🔴 [sql] Error:", e?.message, e?.stack); return []; }
}
