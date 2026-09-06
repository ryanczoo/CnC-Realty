process.env.POSTMARK_SERVER_TOKEN = "test-key";
process.env.NEXTAUTH_URL = "http://localhost:3000";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendEmail } from "@/lib/email/send";
import {
  sendApprovalDocuments,
  sendPasswordReset,
  sendAnnouncement,
  sendLeadNotification,
  sendApplicationNotification,
  sendApplicationApproved,
  sendApplicationRejected,
  emailLayout,
  buildHeadingBodyHtml,
} from "@/lib/email";

describe("sendApprovalDocuments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends one email to the agent with the W-9 and Office Policy Manual attached", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jane@example.com");
    expect(call.replyTo).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jane");

    expect(call.attachments).toHaveLength(2);
    for (const attachment of call.attachments!) {
      expect(attachment.contentType).toBe("application/pdf");
      expect(typeof attachment.content).toBe("string");
      expect(attachment.content.length).toBeGreaterThan(100);
    }
    const filenames = call.attachments!.map((a) => a.filename);
    expect(filenames.some((f) => /w-?9/i.test(f))).toBe(true);
    expect(filenames.some((f) => /office policy manual/i.test(f))).toBe(true);
  });

  it("subject is just 'Onboarding Documents'", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.subject).toBe("Onboarding Documents");
  });

  it("puts the header photo right below the shared logo header, above the heading text", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("onboarding-photo.jpg");
    const headingIndex = html.indexOf("Let's get started, Jane!");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
  });

  it("uses the reworded copy and trimmed bullet lists", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).toContain('Here is some "boring" stuff we have to get out of the way...');
    expect(html).toContain("Attached you will find the following:");
    expect(html).toContain("<li>Blank IRS W-9 Form</li>");
    expect(html).toContain("<li>Office Policy</li>");
    expect(html).not.toContain("Welcome to CnC Realty! Attached you'll find:");
    expect(html).not.toContain("A blank IRS Form W-9");
    expect(html).not.toContain("CnC Realty's Office Policy Manual");

    expect(html).toContain("Please complete and provide the following for our records:");
    expect(html).toContain("&#10003; IRS W-9 Form");
    expect(html).toContain("&#10003; Copy of California DRE license");
    expect(html).not.toContain("<li>IRS W-9 Form</li>");
    expect(html).not.toContain("<li>Copy of California DRE license</li>");
    expect(html).not.toContain("Please reply to this email with:");
    expect(html).not.toContain("Your completed W-9");
    expect(html).not.toContain("A copy of your active California DRE license");
    expect(html).not.toContain("A headshot for your agent profile page");
  });

  it("links 'Board of REALTORS®' to car.org in the closing MLS-membership line", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).toContain('<a href="https://www.car.org" style="color: #9E8C61;">Board of REALTORS&reg;</a>');
    expect(html).toContain("and a local MLS Association! This is required for access to the MLS, ZipForms, legal guidance, and more.");
    expect(html).not.toContain("MLS association that covers the area(s) you work in");
    expect(html).not.toContain("to gain access to the MLS, ZipForms, legal guidance, and more!");
  });

  it("matches the welcome email's body text size, and bolds the two 'attached/please provide' headers", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).not.toContain("font-size: 15px");
    expect(html).toContain(
      'style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; font-weight: 700; margin: 0 0 16px;">\n      Attached you will find the following:'
    );
    expect(html).toContain(
      'style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; font-weight: 700; margin: 0 0 16px;">\n      Please complete and provide the following for our records:'
    );
  });

  it("matches the welcome email's heading size, and indents both the bullet list and the checkmarks", async () => {
    await sendApprovalDocuments("jane@example.com", "Jane");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 16px; text-align: center;">'
    );
    expect(html).toContain('<ul style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; margin: 0 0 16px; padding-left: 40px;">');
    expect(html).toContain(
      '<p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; margin: 0 0 8px; padding-left: 20px;">&#10003; IRS W-9 Form</p>'
    );
    expect(html).toContain(
      '<p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: left; margin: 0 0 16px; padding-left: 20px;">&#10003; Copy of California DRE license</p>'
    );
  });
});

describe("sendAnnouncement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails every recipient individually from info@cncrealtygroup.com", async () => {
    await sendAnnouncement(
      ["agent1@example.com", "agent2@example.com"],
      "Office Closed Monday",
      "We will be closed for the holiday."
    );

    expect(sendEmail).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.to).sort()).toEqual(["agent1@example.com", "agent2@example.com"]);
    for (const call of calls) {
      expect(call.from).toEqual({ email: "info@cncrealtygroup.com", name: "CnC Realty" });
      expect(call.stream).toBe("transactional");
      expect(call.subject).toBe("Announcement: Office Closed Monday");
      expect(call.html).toContain("Office Closed Monday");
      expect(call.html).toContain("We will be closed for the holiday.");
    }
  });

  it("styles the title like the welcome email's heading, and the body to match its text size/color", async () => {
    await sendAnnouncement(["agent1@example.com"], "Office Closed Monday", "We will be closed for the holiday.");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const headingIndex = html.indexOf("Office Closed Monday");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(headingIndex).toBeGreaterThan(logoIndex);
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">'
    );
    expect(html).toContain(
      '<p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: left; margin: 0; white-space: pre-wrap;">'
    );
    expect(html).not.toContain("font-size: 15px");
  });

  it("includes the announcement photo, sized like the welcome email's photo, above the heading", async () => {
    await sendAnnouncement(["agent1@example.com"], "Office Closed Monday", "We will be closed for the holiday.");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("announcement-photo.jpg");
    const headingIndex = html.indexOf("Office Closed Monday", photoIndex);

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).toContain(
      '<img src="http://localhost:3000/announcement-photo.jpg" alt="" width="100%" style="display: block; width: 100%; border-radius: 8px; border: 0;" />'
    );
  });
});

describe("sendPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the reset link to the given address", async () => {
    await sendPasswordReset("jane@example.com", "http://localhost:3000/reset-password?token=abc123");

    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0][0];

    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    // No override — the seam supplies the default noreply@ FROM.
    expect(call.from).toBeUndefined();
    expect(call.html).toContain("http://localhost:3000/reset-password?token=abc123");
  });
});

describe("sendLeadNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies the brokerage inbox with the lead's details", async () => {
    await sendLeadNotification({
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      phone: "555-1234",
      notes: "Interested in Pasadena listings",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jordan Lee");
    expect(call.html).toContain("jordan@example.com");
    expect(call.html).toContain("Interested in Pasadena listings");
  });
});

describe("sendApplicationNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies the brokerage inbox with the applicant's details", async () => {
    await sendApplicationNotification({
      id: "app-1",
      firstName: "Jane",
      lastName: "Agent",
      email: "jane@example.com",
    });

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("info@cncrealtygroup.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jane Agent");
    expect(call.html).toContain("jane@example.com");
  });
});

describe("sendApplicationApproved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the applicant their account setup link", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Jane");
    expect(call.html).toContain("http://localhost:3000/setup-account?token=abc");
  });

  it("includes the welcome photo, in the body content (not the shared header)", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("agent-welcome-photo.jpg");
  });

  it("attaches the black, gold, and white logo PNGs", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.attachments).toHaveLength(3);
    for (const attachment of call.attachments!) {
      expect(attachment.contentType).toBe("image/png");
      expect(typeof attachment.content).toBe("string");
      expect(attachment.content.length).toBeGreaterThan(100);
    }
    const filenames = call.attachments!.map((a) => a.filename);
    expect(filenames).toEqual([
      "CnC Realty Logo - Black.png",
      "CnC Realty Logo - Gold.png",
      "CnC Realty Logo - White.png",
    ]);
  });

  it("puts the welcome heading under the photo, not above it", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const photoIndex = call.html!.indexOf("agent-welcome-photo.jpg");
    const headingIndex = call.html!.indexOf("Hey Jane, We've Been Expecting You!");
    expect(photoIndex).toBeGreaterThan(-1);
    expect(headingIndex).toBeGreaterThan(photoIndex);
  });

  it("uses the new welcome copy instead of the old approval message", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Your application is approved.");
    expect(call.html).not.toContain("Click the button below to set your password");
  });

  it("labels the CTA button 'Create Password', not 'Set Up My Account'", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Create Password");
    expect(call.html).not.toContain("Set Up My Account");
  });

  it("includes DRE eLicensing update instructions after the button", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const buttonIndex = html.indexOf("Create Password");
    const instructionsIndex = html.indexOf("DRE eLicensing");

    expect(buttonIndex).toBeGreaterThan(-1);
    expect(instructionsIndex).toBeGreaterThan(buttonIndex);
    expect(html).toContain("Add/Change main office address");
    expect(html).toContain("Change Responsible Broker/Add Responsible Broker");
    expect(html).toContain("info@cncrealtygroup.com");
    expect(html).toContain("02439028");
    expect(html).toContain("built <em>by</em> agents <em>for</em> agents");
    expect(html).toContain("(562) 335-1759");
  });

  it("center-aligns the DRE instructions block underneath the button", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain(
      'margin: 32px 0 0; color: #4b4b4b; font-size: 22.5px; line-height: 1.8; text-align: center;'
    );
  });

  it("links 'DRE eLicensing account' to the real DRE eLicensing site", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain('<a href="https://secure.dre.ca.gov/elicensing/"');
    expect(call.html).toContain(">DRE eLicensing account</a>");
  });

  it("links the agent's personal webpage using their slug, after the 'ready to take advantage' line", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const profileUrl = "http://localhost:3000/agents/jane-doe-a1b2c3";
    const readyIndex = html.indexOf("ready to take advantage");
    const linkIndex = html.indexOf(`href="${profileUrl}"`);

    expect(readyIndex).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(readyIndex);
    expect(html).toContain("Customize your personal webpage</p>");
    expect(html).toContain(`<a href="${profileUrl}" style="color: #9E8C61;">${profileUrl}</a>`);
  });

  it("lists the dashboard, CnC Academy, and connecting with other agents as next steps", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).toContain("Explore the CnC dashboard");
    expect(call.html).toContain("Learn tips &amp; tricks from CnC Academy");
    expect(call.html).toContain("Connect with your fellow CnC agents");
  });

  it("rewords the DRE update intro and the office-address step, bolding the two step headers", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    expect(html).toContain("please confirm your");
    expect(html).toContain("has been updated:");
    expect(html).not.toContain("with CnC Realty's info:");
    expect(html).not.toContain("you have updated your DRE eLicensing account");
    expect(html).toContain(
      '<p style="margin: 0 0 20px; font-weight: 700;">1. Select "Add/Change main office address"</p>'
    );
    expect(html).not.toContain("and update to:");
    expect(html).not.toContain("and change it to reflect:");
    expect(html).toContain(
      '<p style="margin: 0 0 20px; font-weight: 700;">2. Select "Change Responsible Broker/Add Responsible Broker"</p>'
    );
    expect(html).not.toContain('Responsible Broker."');
  });

  it("uses bullets instead of lettered sub-items under both numbered steps", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    // 4 bullets total: the blank address line under step 1, plus the 3 sub-steps under step 2
    expect(html.match(/&bull;/g)?.length).toBe(4);
    expect(html).not.toMatch(/>a\.\s/);
    expect(html).not.toMatch(/>b\.\s/);
    expect(html).not.toMatch(/>c\.\s/);
    expect(html).toContain('<p style="margin: 0 0 44px; padding-left: 20px; font-size: 18px;">&bull; Enter&nbsp;</p>');
    expect(html).toContain('&bull; Select No for "Is the broker available to certify your acceptance now?"');
    expect(html).toContain("&bull; Enter info@cncrealtygroup.com for Broker's email address");
    expect(html).toContain("&bull; Enter 02439028 for Broker's license #");
  });

  it("gives paragraphs more breathing room than the original tight 16px/0 spacing", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const instructionsBlock = html.slice(
      html.indexOf("Once you finish"),
      html.indexOf("for</em> agents")
    );
    expect(instructionsBlock).not.toContain("margin: 0 0 16px");
    expect(instructionsBlock).not.toContain('margin: 0; padding-left: 20px;');
    expect(instructionsBlock).not.toContain("margin: 0 0 24px");
    expect(instructionsBlock).not.toContain("margin: 0 0 12px;");
    expect(instructionsBlock).not.toContain("margin: 0 0 8px;");
    expect(instructionsBlock).not.toContain("margin: 0 0 32px");
    expect(instructionsBlock).toContain("margin: 0 0 44px");
    expect(instructionsBlock).toContain("margin: 0 0 20px");
  });

  it("moves the sign-off and contact info into the shared footer, replacing the default", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).not.toContain("- CnC Realty Group");

    const footerIndex = html.indexOf("- CnC Realty Team");
    const socialIconsIndex = html.indexOf("/icon-facebook.png");
    expect(footerIndex).toBeGreaterThan(-1);
    expect(socialIconsIndex).toBeGreaterThan(footerIndex);

    // the body itself no longer carries the phone number or sign-off -- they
    // only appear once, in the footer. The email address legitimately
    // appears a second time in the unrelated DRE bullet instructions, so
    // that one isn't checked for uniqueness here.
    expect(html.match(/- CnC Realty Team/g)?.length).toBe(1);
    expect(html.match(/\(562\) 335-1759/g)?.length).toBe(1);

    const bodyBeforeFooter = html.slice(0, footerIndex);
    expect(bodyBeforeFooter).not.toContain("(562) 335-1759");
  });

  it("uses gray icon images instead of 'Office:'/'Email:' text labels in the footer", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;

    expect(html).toContain('<img src="http://localhost:3000/icon-phone.png"');
    expect(html).toContain('<img src="http://localhost:3000/icon-mail.png"');
    expect(html).not.toContain("Office:");
    expect(html).not.toContain("Email:");

    const phoneIconIndex = html.indexOf("icon-phone.png");
    const phoneNumberIndex = html.indexOf("(562) 335-1759");
    const mailIconIndex = html.indexOf("icon-mail.png");
    const emailAddressIndex = html.lastIndexOf("info@cncrealtygroup.com");
    expect(phoneIconIndex).toBeGreaterThan(-1);
    expect(phoneNumberIndex).toBeGreaterThan(phoneIconIndex);
    expect(mailIconIndex).toBeGreaterThan(-1);
    expect(emailAddressIndex).toBeGreaterThan(mailIconIndex);
  });

  it("bumps body text to 1.5x size but leaves the CTA button untouched", async () => {
    await sendApplicationApproved("jane@example.com", "Jane", "http://localhost:3000/setup-account?token=abc", "jane-doe-a1b2c3");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    expect(html).toContain("font-size: 33px"); // heading, was 22px
    expect(html).toContain("font-size: 22.5px"); // body copy, was 15px
    expect(html).not.toContain("font-size: 15px");
    expect(html).toContain("font-size: 14px"); // button, unchanged
  });
});

describe("sendApplicationRejected", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emails the applicant the rejection reason", async () => {
    await sendApplicationRejected("jane@example.com", "Jane", "Not enough experience");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.to).toBe("jane@example.com");
    expect(call.stream).toBe("transactional");
    expect(call.html).toContain("Not enough experience");
  });

  it("does not include the welcome photo -- that's specific to the approval email only", async () => {
    await sendApplicationRejected("jane@example.com", "Jane", "Not enough experience");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    expect(call.html).not.toContain("agent-welcome-photo.jpg");
  });

  it("uses its own photo, a welcome-style heading with just the first name, and matching body/bold styling", async () => {
    await sendApplicationRejected("jane@example.com", "Jane Applicant", "Not enough experience");

    const call = vi.mocked(sendEmail).mock.calls[0][0];
    const html = call.html!;
    const logoIndex = html.indexOf("logo-black.png");
    const photoIndex = html.indexOf("application-rejected-photo.jpg");
    const headingIndex = html.indexOf("We Are So Sorry");

    expect(logoIndex).toBeGreaterThan(-1);
    expect(photoIndex).toBeGreaterThan(logoIndex);
    expect(headingIndex).toBeGreaterThan(photoIndex);
    expect(html).toContain(
      '<h2 style="color: #1B1B1B; font-weight: 400; font-size: 33px; margin: 0 0 24px; text-align: center;">\n      Hi Jane, We Are So Sorry'
    );
    expect(html).not.toContain("Hi Jane Applicant");
    expect(html).toContain(
      '<p style="color: #4b4b4b; font-size: 22.5px; line-height: 1.6; text-align: center; margin: 0 0 20px;">\n      After a thorough review, we are unable to move forward with your application at this time.'
    );
    expect(html).toContain('<strong style="font-weight: 700;">Reason:</strong> Not enough experience');
    expect(html).toContain(
      'Thank you for your interest in joining CnC Realty. If you have any questions, please feel free to <a href="mailto:info@cncrealtygroup.com" style="color: #9E8C61;">reach out</a>!'
    );
    expect(html).not.toContain("font-size: 15px");
    expect(html).not.toContain("Thank you for your interest in joining CnC Realty. After reviewing");
    expect(html).not.toContain("If you have questions, please reach out to");
  });
});

describe("emailLayout", () => {
  const html = () => emailLayout({ heading: "Test Heading", bodyHtml: "<p>Body</p>" });

  it("uses the site's off-white background instead of pure white", () => {
    expect(html()).toContain("#F2F0EF");
  });

  it("loads Inter from Google Fonts with a system fallback stack", () => {
    const result = html();
    expect(result).toContain("fonts.googleapis.com/css2?family=Inter");
    expect(result).toContain("'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif");
  });

  it("includes social icon links below the footer signature", () => {
    const result = html();

    expect(result).toContain('href="https://www.facebook.com/CnCRealtyGroup"');
    expect(result).toContain('href="https://www.instagram.com/cncrealty"');
    expect(result).toContain('href="https://www.youtube.com/@CnCRealtyGroup"');
    expect(result).toContain("/icon-facebook.png");
    expect(result).toContain("/icon-instagram.png");
    expect(result).toContain("/icon-youtube.png");

    const footerIndex = result.indexOf("CnC Realty Team");
    const iconsIndex = result.indexOf("/icon-facebook.png");
    expect(footerIndex).toBeGreaterThan(-1);
    expect(iconsIndex).toBeGreaterThan(footerIndex);
  });

  it("stays off-white everywhere -- no separate white section anywhere in the layout", () => {
    const result = html();
    expect(result).toMatch(/<body[^>]*background-color:\s*#F2F0EF/i);
    // Only the CTA button's white text color should ever mention #ffffff --
    // no element should set it as a background.
    expect(result).not.toMatch(/background-color:\s*#ffffff/i);
  });

  it("omits the heading element entirely when heading is empty, instead of an empty <h2>", () => {
    const result = emailLayout({ heading: "", bodyHtml: "<p>Body</p>" });
    expect(result).not.toContain("<h2");
  });

  it("uses a plain hyphen in the footer signature, not an em dash", () => {
    expect(html()).toContain("- CnC Realty Team");
  });

  it("defaults the footer to the icon-based sign-off shared with the welcome email, not the old plain text", () => {
    const result = html();
    expect(result).not.toContain("- CnC Realty Group");
    expect(result).toContain('<img src="http://localhost:3000/icon-phone.png"');
    expect(result).toContain('<img src="http://localhost:3000/icon-mail.png"');
    expect(result).toContain("(562) 335-1759");
    expect(result).toContain("info@cncrealtygroup.com");
  });

  it("still lets a caller override the default footer when explicitly given one", () => {
    const result = emailLayout({ heading: "Test", bodyHtml: "<p>Body</p>", footer: "Custom footer text" });
    expect(result).toContain("Custom footer text");
    expect(result).not.toContain("icon-phone.png");
  });

  it("has no max-width cap -- stretches to fill however wide the viewer's window is", () => {
    const result = html();
    expect(result).not.toMatch(/max-width/i);
    expect(result).toMatch(/<div style="[^"]*width:\s*100%/i);
  });

  it("uses the black logo, not the gold one", () => {
    expect(html()).toContain("logo-black.png");
    expect(html()).not.toContain("logo-gold.png");
  });

  it("wraps the header logo in a link back to the homepage, without changing the image itself", () => {
    const result = html();
    expect(result).toContain(
      '<a href="http://localhost:3000" style="display: inline-block; border: 0; text-decoration: none;">'
    );
    expect(result).toContain(
      '<img src="http://localhost:3000/logo-black.png" alt="CnC Realty" width="160" style="display: inline-block; border: 0;" />'
    );
    const linkIndex = result.indexOf('<a href="http://localhost:3000"');
    const imgIndex = result.indexOf("logo-black.png");
    expect(imgIndex).toBeGreaterThan(linkIndex);
  });

  it("renders the YouTube icon larger than Facebook and Instagram so they read as the same visual size", () => {
    const result = html();
    const widthOf = (file: string) => {
      const match = result.match(new RegExp(`${file}"[^>]*width="(\\d+)"`));
      if (!match) throw new Error(`no width found for ${file}`);
      return Number(match[1]);
    };

    const fbWidth = widthOf("icon-facebook\\.png");
    const igWidth = widthOf("icon-instagram\\.png");
    const ytWidth = widthOf("icon-youtube\\.png");

    expect(fbWidth).toBe(igWidth);
    expect(ytWidth).toBeGreaterThan(fbWidth);
  });

  it("vertically centers the social icons so different-sized icons stay level with each other", () => {
    const result = html();
    const iconImgTags = result.match(/<img src="[^"]*icon-(facebook|instagram|youtube)\.png"[^>]*>/g) ?? [];
    expect(iconImgTags).toHaveLength(3);
    for (const tag of iconImgTags) {
      expect(tag).toMatch(/vertical-align:\s*middle/);
    }
  });
});

describe("buildHeadingBodyHtml", () => {
  it("renders the 33px centered heading and 22.5px/#4b4b4b body styling", () => {
    const html = buildHeadingBodyHtml({ heading: "My Heading", bodyHtml: "<p>Body text</p>" });

    expect(html).toContain("My Heading");
    expect(html).toContain("font-size: 33px");
    expect(html).toContain("font-size: 22.5px");
    expect(html).toContain("#4b4b4b");
    expect(html).toContain("<p>Body text</p>");
  });

  it("scopes paragraph spacing to its own content, not globally", () => {
    const html = buildHeadingBodyHtml({ heading: "H", bodyHtml: "<p>x</p>" });
    expect(html).toContain("#campaign-content p { margin: 0 0 20px; }");
  });
});
