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
 * Unified invitation email for both teacher and student invites.
 * role ∈ { 'teacher', 'student' }
 */
export async function sendInviteEmail({ toEmail, role, inviterName, schoolName, token }) {
  const link = `${FRONTEND}/invite/${token}`;
  const isTeacher = role === 'teacher';
  const subject = isTeacher
    ? `You're invited as a Teacher at ${schoolName} – IncludEd`
    : `You've been invited to join ${schoolName} on IncludEd`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="color:#6d28d9;font-size:24px;margin:0">📚 IncludEd</h1>
        <p style="color:#6b7280;font-size:13px;margin:4px 0">Adaptive Learning Platform</p>
      </div>
      <h2 style="color:#111827;font-size:18px">
        ${isTeacher ? "You're invited as a Teacher!" : "You've been invited to IncludEd!"}
      </h2>
      <p style="color:#374151;line-height:1.6">
        <strong>${inviterName}</strong> has invited you to ${isTeacher ? 'join as a teacher at' : 'create a student account at'}
        <strong>${schoolName}</strong> on the IncludEd adaptive reading platform.
      </p>
      ${isTeacher ? `<p style="color:#374151;line-height:1.6">After setting up your account, an admin will review and activate it.</p>` : ''}
      <div style="text-align:center;margin:28px 0">
        <a href="${link}"
           style="display:inline-block;padding:14px 32px;background:#6d28d9;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">
          ${isTeacher ? 'Set Up My Teacher Account' : 'Create My Account'}
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center">
        This link expires in 7 days. If you weren't expecting this, you can safely ignore it.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0">
      <p style="font-size:11px;color:#d1d5db;text-align:center">
        Or copy: <a href="${link}" style="color:#6d28d9">${link}</a>
      </p>
    </div>
  `;

  await sendEmail({ toEmail, subject, html });
}

// Legacy helpers (kept for backward compatibility)
export async function sendStudentInvite({ toEmail, teacherName, schoolName, token }) {
  return sendInviteEmail({ toEmail, role: 'student', inviterName: teacherName, schoolName, token });
}

export async function sendTeacherInvite({ toEmail, adminName, schoolName, token }) {
  return sendInviteEmail({ toEmail, role: 'teacher', inviterName: adminName, schoolName, token });
}
