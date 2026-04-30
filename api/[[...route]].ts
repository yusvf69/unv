import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

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
      const [user] = await sql`
        SELECT id, name, username, email, role, "avatarUrl", department, year, points, level, streak, title, "uniqueCode"
        FROM users
        WHERE id = ${currentUserId}
        LIMIT 1
      `;
      if (!user) return res.status(404).json({ error: "لا يوجد مستخدم" });
      return res.json(user);
    }
    
    if (url === "/api/health" || url === "/health") {
      return res.json({ status: "ok" });
    }
    
    res.status(404).json({ error: "Not found" });
  } catch (err: any) {
    console.error("API Error:", err);
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
