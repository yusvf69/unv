import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const sql = neon(DATABASE_URL, {
  fetch: (url: string, options: any) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    return fetch(url, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  },
});
