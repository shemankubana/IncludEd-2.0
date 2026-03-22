/**
 * emailService.js
 * Thin wrapper around Nodemailer for sending transactional emails.
 *
 * Configure via env vars:
 *   EMAIL_HOST     — SMTP host        (default: smtp.gmail.com)
 *   EMAIL_PORT     — SMTP port        (default: 587)
 *   EMAIL_USER     — SMTP username / sender address
 *   EMAIL_PASS     — SMTP password / Gmail app-password
 *   EMAIL_FROM     — "From" display   (default: "IncludEd Platform <EMAIL_USER>")
 *   FRONTEND_URL   — base URL for invite links
 */

import nodemailer from 'nodemailer';
import Mailjet from 'node-mailjet';

const mailjet = (process.env.MJ_APIKEY_PUBLIC && process.env.MJ_APIKEY_PRIVATE)
  ? new Mailjet({
      apiKey: process.env.MJ_APIKEY_PUBLIC,
      apiSecret: process.env.MJ_APIKEY_PRIVATE
    })
  : null;

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM_STR = process.env.EMAIL_FROM || `IncludEd Platform <${process.env.EMAIL_USER || 'no-reply@included.com'}>`;
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:8080';

/**
 * Helper to parse "Name <email@domain.com>" or just "email@domain.com"
 */
function parseFrom(str) {
  const match = str.match(/(.*)<(.+)>/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'IncludEd Platform', email: str.trim() };
}

async function sendEmail({ toEmail, subject, html }) {
  if (mailjet) {
    const { name, email } = parseFrom(FROM_STR);
    try {
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: { Email: email, Name: name },
          To: [{ Email: toEmail }],
          Subject: subject,
          HTMLPart: html,
        }]
      });
      return;
    } catch (err) {
      console.error('Mailjet failed, falling back to SMTP:', err.message);
    }
  }
  
  // Fallback to Nodemailer
  await transporter.sendMail({ from: FROM_STR, to: toEmail, subject, html });
}

/**
 * Send a student invitation email (sent by teacher).
 */
export async function sendStudentInvite({ toEmail, teacherName, schoolName, schoolCode }) {
  const link = `${FRONTEND}/auth?code=${schoolCode}&role=student`;
  const subject = `You've been invited to join ${schoolName} on IncludEd`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#6d28d9">Welcome to IncludEd!</h2>
      <p><strong>${teacherName}</strong> has invited you to join <strong>${schoolName}</strong>
         on the IncludEd adaptive reading platform.</p>
      <p>Click below to create your student account:</p>
      <a href="${link}"
         style="display:inline-block;padding:12px 28px;background:#6d28d9;color:#fff;
                border-radius:8px;text-decoration:none;font-weight:bold;margin:12px 0">
        Create My Account
      </a>
      <p style="font-size:12px;color:#888">
        Or copy this link: <a href="${link}">${link}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:11px;color:#aaa">
        School code: <strong>${schoolCode}</strong> · IncludEd Adaptive Learning Platform
      </p>
    </div>
  `;

  await sendEmail({ toEmail, subject, html });
}

/**
 * Send a teacher invitation email (sent by admin).
 */
export async function sendTeacherInvite({ toEmail, adminName, schoolName, schoolCode }) {
  const link = `${FRONTEND}/auth?code=${schoolCode}&role=teacher`;
  const subject = `Teacher invitation: ${schoolName} on IncludEd`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#6d28d9">You're invited as a Teacher!</h2>
      <p><strong>${adminName}</strong> has invited you to set up a teacher account
         at <strong>${schoolName}</strong> on the IncludEd adaptive reading platform.</p>
      <p>Click below to create your teacher account — you will need school approval before you can log in:</p>
      <a href="${link}"
         style="display:inline-block;padding:12px 28px;background:#6d28d9;color:#fff;
                border-radius:8px;text-decoration:none;font-weight:bold;margin:12px 0">
        Set Up Teacher Account
      </a>
      <p style="font-size:12px;color:#888">
        Or copy this link: <a href="${link}">${link}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="font-size:11px;color:#aaa">
        School code: <strong>${schoolCode}</strong> · IncludEd Adaptive Learning Platform
      </p>
    </div>
  `;

  await sendEmail({ toEmail, subject, html });
}
