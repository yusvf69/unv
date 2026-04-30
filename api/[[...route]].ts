import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export default async function handler(req: any, res: any) {
  const url = req.url || "";
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies["uv_demo_user"];
  const id = raw ? parseInt(raw, 10) : NaN;
  const currentUserId = Number.isFinite(id) && id > 0 ? id : null;

  try {
    if (url === "/api/me" || url === "/me") {
      if (!currentUserId) {
        return res.status(404).json({ error: "لا يوجد مستخدم" });
      }
      const [user] = await db.select()
        .from(schema.usersTable)
        .where(eq(schema.usersTable.id, currentUserId))
        .limit(1);
      if (!user) return res.status(404).json({ error: "لا يوجد مستخدم" });
      return res.json({
        id: user.id, name: user.name, username: user.username,
        email: user.email, role: user.role, avatarUrl: user.avatarUrl,
        department: user.department, year: user.year, points: user.points,
        level: user.level, streak: user.streak, title: user.title,
        uniqueCode: user.uniqueCode,
      });
    }
    
    if (url === "/api/health" || url === "/health") {
      return res.json({ status: "ok" });
    }
    
    res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

function parseCookies(cookie: string) {
  const obj: Record<string, string> = {};
  cookie.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    if (k.trim()) obj[k.trim()] = v.join("=").trim();
  });
  return obj;
}
