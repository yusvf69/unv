export const config = { runtime: "nodejs", maxDuration: 5 };

export default async function handler(request: Request): Promise<Response> {
  return new Response(JSON.stringify({
    status: "ok",
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length ?? 0,
    DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 15) ?? "NOT SET",
    NODE_ENV: process.env.NODE_ENV ?? "not set",
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
