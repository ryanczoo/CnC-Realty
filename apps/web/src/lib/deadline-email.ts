import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface DeadlineReminder {
  agentEmail: string;
  agentName: string | null;
  address: string;
  label: string;
  date: Date;
  daysOut: number;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function sendDeadlineReminder(reminder: DeadlineReminder): Promise<void> {
  const dayWord = reminder.daysOut === 0 ? "today" : reminder.daysOut === 1 ? "tomorrow" : `in ${reminder.daysOut} days`;
  const safeName = escapeHtml(reminder.agentName ?? "there");
  const safeAddress = escapeHtml(reminder.address);
  const safeLabel = escapeHtml(reminder.label);
  await sgMail.send({
    to: reminder.agentEmail,
    from: FROM,
    subject: `Deadline reminder: ${reminder.label} for ${reminder.address}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#1B1B1B">Upcoming Deadline — CnC Realty</h2>
        <p>Hi ${safeName},</p>
        <p>This is a reminder that the <strong>${safeLabel}</strong> deadline for
           <strong>${safeAddress}</strong> is <strong>${dayWord}</strong>
           (${reminder.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}).</p>
        <p>Log in to your dashboard to review the transaction details.</p>
        <a href="https://cncrealtygroup.com/dashboard/transactions"
           style="display:inline-block;margin-top:16px;padding:12px 24px;background:#9E8C61;color:#fff;border-radius:999px;text-decoration:none;font-weight:500">
          View Transaction
        </a>
        <p style="margin-top:32px;color:#999;font-size:12px">CnC Realty Group · Los Angeles, CA · CA DRE #02439028</p>
      </div>
    `,
  });
}
