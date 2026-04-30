import type { Response } from "express";
import { ZodError } from "zod";

export function handle<T>(res: Response, fn: () => Promise<T>): Promise<void> {
  return fn().then(
    (value) => {
      res.json(value);
    },
    (err: unknown) => {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Validation failed: " + err.message });
        return;
      }
      const e = err as { status?: number; message?: string };
      const message = e?.message ?? "Internal error";
      const status = e?.status ?? 500;
      res.status(status).json({ error: message });
    },
  );
}

export function letterFromScore(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 85) return "A";
  if (pct >= 80) return "A-";
  if (pct >= 75) return "B+";
  if (pct >= 70) return "B";
  if (pct >= 65) return "B-";
  if (pct >= 60) return "C+";
  if (pct >= 55) return "C";
  if (pct >= 50) return "C-";
  return "D";
}
