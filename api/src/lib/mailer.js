import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// If SMTP is configured, send real mail. Otherwise use a JSON transport that
// just captures the message so we can log it (handy in development).
const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

const isLive = !!env.smtp.host;

export async function sendMail({ to, subject, text, html }) {
  if (!to) return;
  try {
    const info = await transporter.sendMail({ from: env.smtp.from, to, subject, text, html });
    if (isLive) {
      console.log(`[mail] sent "${subject}" -> ${to}`);
    } else {
      console.log(`[mail:dev] would send "${subject}" -> ${to}`);
    }
    return info;
  } catch (err) {
    // Never let an email failure break the request flow.
    console.error('[mail] failed:', err.message);
  }
}
