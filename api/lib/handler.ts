export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export function jsonError(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export async function handle(fn: () => Promise<any>): Promise<Response> {
  try {
    const data = await fn();
    return jsonResponse(data);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    return jsonError(message, status);
  }
}
