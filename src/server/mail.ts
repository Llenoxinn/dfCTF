import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

export type LocalMail = { id: string; to: string; subject: string; url: string; createdAt: string; text?:string; replyTo?:string };

export function localMailEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.LOCAL_MAIL === "1";
}

const mailDirectory = () => path.join(process.cwd(), ".data", "mail");

export async function sendAuthEmail(to: string, subject: string, url: string) {
  await sendTextEmail({to,subject,text:`${subject}\n\n${url}\n\nIf you did not request this email, you can ignore it.`},url);
}

export async function sendTextEmail(message:{to:string;subject:string;text:string;replyTo?:string},url="") {
  if (localMailEnabled()) {
    const mail: LocalMail = { id: randomUUID(), ...message, url, createdAt: new Date().toISOString() };
    await mkdir(mailDirectory(), { recursive: true });
    await writeFile(path.join(mailDirectory(), `${mail.id}.json`), JSON.stringify(mail), { mode: 0o600 });
    return;
  }
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) {
    throw new Error("Email delivery requires SMTP_URL and MAIL_FROM. For loopback development, explicitly enable LOCAL_MAIL=1.");
  }
  const transport = nodemailer.createTransport({url:process.env.SMTP_URL,connectionTimeout:10_000,socketTimeout:15_000});
  const result=await transport.sendMail({
    from: process.env.MAIL_FROM,
    ...message,
  });
  if(!result.accepted?.length)throw new Error("Email was not accepted for delivery.");
}

export async function listLocalMail(): Promise<LocalMail[]> {
  if (!localMailEnabled()) return [];
  let filenames: string[];
  try {
    filenames = await readdir(mailDirectory());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const mail = await Promise.all(filenames.filter((name) => /^[a-f0-9-]+\.json$/.test(name)).map(async (name) => {
    return JSON.parse(await readFile(path.join(mailDirectory(), name), "utf8")) as LocalMail;
  }));
  return mail.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
}
