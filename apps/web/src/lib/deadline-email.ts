import { emailLayout } from "@/lib/email";
import { sendEmail } from "@/lib/email/send";

export interface DeadlineReminder {
  agentEmail: string;
  agentName: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  label: string;
  date: Date;
  daysOut: number;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// "an Inspection deadline" vs "a Loan Approval deadline" -- picked from the
// label's own leading sound rather than hardcoded, since deadline labels vary.
function articleFor(label: string): "a" | "an" {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

export async function sendDeadlineReminder(reminder: DeadlineReminder): Promise<void> {
  const safeName = escapeHtml(reminder.agentName ?? "there");
  const safeAddress = escapeHtml(reminder.address);
  const safeCityStateZip = escapeHtml(
    [reminder.city, [reminder.state, reminder.zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ")
  );
  const safeLabel = escapeHtml(reminder.label);
  const formattedDate = reminder.date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const bodyHtml = `
    <div style="margin: 0 0 24px;">
      <img src="${process.env.NEXTAUTH_URL}/deadline-reminder-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />
    </div>
    <h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">
      Upcoming Deadline
    </h2>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0 0 32px;">
      Hi ${safeName}, friendly reminder that your listing at:
    </p>
    <p style="color: #1B1B1B; font-size: 22.5px; line-height: 1.6; text-align: center; font-weight: 700; margin: 0 0 32px;">
      ${safeAddress},<br />
      ${safeCityStateZip}
    </p>
    <p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center; margin: 0;">
      has ${articleFor(reminder.label)} <strong style="color: #1B1B1B;">${safeLabel}</strong> deadline on <strong style="color: #1B1B1B;">${formattedDate}</strong>.
    </p>
  `;

  const html = emailLayout({
    heading: "",
    bodyHtml,
    ctaLabel: "View Transaction",
    ctaHref: `${process.env.NEXTAUTH_URL}/dashboard/transactions`,
  });

  await sendEmail({
    to: reminder.agentEmail,
    subject: `Deadline reminder: ${reminder.label} for ${reminder.address}`,
    html,
    stream: "transactional",
  });
}
