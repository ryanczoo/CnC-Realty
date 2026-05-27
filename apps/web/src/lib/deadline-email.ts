import sgMail from "@sendgrid/mail";
import { FROM } from "@/lib/email";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export interface DeadlineReminder {
  agentEmail: string;
  agentName: string | null;
  address: string;
  label: string;
  date: Date;
  daysOut: number;
}

export async function sendDeadlineReminder(reminder: DeadlineReminder): Promise<void> {
  const dayWord = reminder.daysOut === 1 ? "tomorrow" : `in ${reminder.daysOut} days`;
  await sgMail.send({
    to: reminder.agentEmail,
    from: FROM,
    subject: `Deadline reminder: ${reminder.label} for ${reminder.address}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#1B1B1B">Upcoming Deadline — CnC Realty</h2>
        <p>Hi ${reminder.agentName ?? "there"},</p>
        <p>This is a reminder that the <strong>${reminder.label}</strong> deadline for
           <strong>${reminder.address}</strong> is <strong>${dayWord}</strong>
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
