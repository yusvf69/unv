import { createServer } from "node:http";
import handler from "./index";

const PORT = process.env.PORT || 8080;

const server = createServer(async (req, res) => {
  const url = `http://localhost:${PORT}${req.url}`;
  let body = "";
  for await (const chunk of req) body += chunk;

  const request = new Request(url, {
    method: req.method,
    headers: new Headers(Object.entries(req.headers).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)])),
    body: body || undefined,
  });

  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
});

server.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
