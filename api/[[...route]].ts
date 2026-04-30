// @ts-nocheck
import app from "../artifacts/api-server/src/app";

export default async function handler(req: any, res: any) {
  return new Promise<void>((resolve) => {
    res.on("finish", () => resolve());
    app(req, res, () => resolve());
  });
}
