import jwt from "jsonwebtoken";
import { sql } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

interface JwtPayload {
  userId: number;
  role: string;
}

export function generateToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
}

export async function getUserId(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function getCurrentUser(userId: number | null) {
  if (!userId) return null;
  const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

export function requireAuth(headers: Headers): { userId: number } {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("غير مسجل"), { status: 401 });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { userId: decoded.userId };
  } catch {
    throw Object.assign(new Error("توكن غير صالح"), { status: 401 });
  }
}

export function requireRole(user: any, roles: string[]) {
  if (!user || !roles.includes(user.role)) {
    throw Object.assign(new Error("غير مصرح"), { status: 403 });
  }
}

export function ensureSuper(user: any) {
  if (user.role !== "super_admin") {
    throw Object.assign(new Error("السوبر أدمن فقط"), { status: 403 });
  }
}
