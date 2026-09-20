import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || process.env.unvst_DATABASE_URL || process.env.unvst_POSTGRES_URL || "";
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  const client = await getPool().connect();
  try {
    const text = strings.map((part, i) => part + (i < values.length ? `$${i + 1}` : "")).join("");
    const result = await client.query({ text, values });
    return result.rows;
  } finally {
    client.release();
  }
}
