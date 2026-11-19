export type EventTextInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  role?: string;
  meetingType: "PHONE" | "MEET";
  bookingSource: "CONTACT" | "JOIN" | "RECRUITING_EMAIL";
};

export const SOURCE_LABEL = {
  CONTACT: "Contact page",
  JOIN: "Join page",
  RECRUITING_EMAIL: "Recruiting email",
} as const;

export function eventSummary(i: Pick<EventTextInput, "firstName" | "lastName" | "role">): string {
  const role = i.role ? ` (${i.role})` : "";
  return `Call with ${i.firstName} ${i.lastName}${role} – CnC`;
}

export function eventDescription(i: EventTextInput): string {
  const lines = [`Email: ${i.email}`];
  if (i.phone) lines.push(`Contact phone: ${i.phone}`);
  if (i.phone && i.meetingType === "PHONE") lines.push(`Phone: ${i.phone}`);
  if (i.role) lines.push(`I am a: ${i.role}`);
  if (i.notes) lines.push(`Message: ${i.notes}`);
  lines.push(`Booked from: ${SOURCE_LABEL[i.bookingSource]}`);
  return lines.join("\n");
}
