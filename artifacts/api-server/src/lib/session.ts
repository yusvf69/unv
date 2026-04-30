import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "uv_demo_user";
const JWT_SECRET = process.env.JWT_SECRET || "uv-secret-change-me";

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

  // Try JWT from Authorization header first
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      id = decoded.userId;
    } catch {
      // Token invalid, fall through to cookie check
    }
  }

  // Fall back to cookie
  if (!id) {
    const raw = req.cookies?.[COOKIE_NAME];
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    id = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  req.demo = { currentUserId: id };
  next();
}

export function setDemoUser(res: Response, id: number) {
  // Set cookie for local dev
  res.cookie(COOKIE_NAME, String(id), {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  // Also attach JWT token to response body for production
  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: "30d" });
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (body && typeof body === "object") {
      body.token = token;
    }
    return originalJson(body);
  };
}
