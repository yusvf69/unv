const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export function jsonError(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export function corsResponse(status = 204): Response {
  return new Response(null, { status, headers: CORS_HEADERS });
}

export async function handle(fn: () => Promise<any>): Promise<Response> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error("Database connection timeout"), { status: 504 })), 8000);
    });
    const data = await Promise.race([fn(), timeout]);
    return jsonResponse(data);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    return jsonError(message, status);
  }
}
