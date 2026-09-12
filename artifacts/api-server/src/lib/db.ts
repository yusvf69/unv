import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "@workspace/db";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 10,
});

export const db = drizzle(pool, { schema });
export { schema };
