import nodemailer from "nodemailer";

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }
  return transporter;
}

export function isMailConfigured(): boolean {
  return !!user && !!pass;
}

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: `"UniVerse" <${user}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch {
    return false;
  }
}
