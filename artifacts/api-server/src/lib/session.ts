import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "uv_demo_user";

function loadSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET environment variable is required (>= 32 chars). Set it in artifacts/api-server/.env");
  }
  return s;
}
const JWT_SECRET = loadSecret();

export interface DemoSession {
  currentUserId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      demo: DemoSession;
    }
  }
}

export function demoSession(req: Request, res: Response, next: NextFunction) {
  let id: number | null = null;

  // Identity comes ONLY from a valid signed JWT (Bearer header).
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      id = Number(decoded.userId) > 0 ? decoded.userId : null;
    } catch {
      id = null;
    }
  }

  req.demo = { currentUserId: id };
  next();
}

export function setDemoUser(res: Response, id: number) {
  // Convenience cookie for local dev only — NEVER trusted for authentication.
  res.cookie(COOKIE_NAME, String(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  // Attach signed JWT to response body for the client.
  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "30d" });
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (body && typeof body === "object") {
      body.token = token;
    }
    return originalJson(body);
  };
}
