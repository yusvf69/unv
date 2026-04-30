import type { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "uv_demo_user";

export interface DemoSession {
  currentUserId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      demo: DemoSession;
    }
  }
}

export function demoSession(req: Request, res: Response, next: NextFunction) {
  const raw = req.cookies?.[COOKIE_NAME];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const id = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  req.demo = { currentUserId: id };
  next();
}

export function setDemoUser(res: Response, id: number) {
  res.cookie(COOKIE_NAME, String(id), {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}
