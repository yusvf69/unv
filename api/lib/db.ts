import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const neonOptions: any = {
  fetch: (url: string, init: any) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  },
};

export const sql = neon(DATABASE_URL, neonOptions);
