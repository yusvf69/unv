import expressApp from "../artifacts/api-server/src/app";

export default function handler(req: any, res: any) {
  expressApp(req, res);
}
