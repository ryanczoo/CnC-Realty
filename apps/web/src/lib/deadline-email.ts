import { emailLayout } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

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
  const bodyHtml = `
    <p style="color: #4b4b4b; font-size: 15px; line-height: 1.6; text-align: center; margin: 0;">
      Hi ${safeName}, this is a reminder that the <strong style="color: #1B1B1B;">${safeLabel}</strong>
      deadline for <strong style="color: #1B1B1B;">${safeAddress}</strong> is
      <strong style="color: #1B1B1B;">${dayWord}</strong>
      (${reminder.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}).
    </p>
  `;

  const html = emailLayout({
    heading: "Upcoming Deadline",
    bodyHtml,
    ctaLabel: "View Transaction",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions`,
    footer: "CnC Realty · Los Angeles, CA · CA DRE #02439028",
  });

  await sendEmail({
    to: reminder.agentEmail,
    subject: `Deadline reminder: ${reminder.label} for ${reminder.address}`,
    html,
    stream: "transactional",
  });
}
