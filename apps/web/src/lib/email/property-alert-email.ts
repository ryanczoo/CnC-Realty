import sgMail from "@sendgrid/mail";

const FROM = "noreply@cncrealtygroup.com";

export interface AlertProperty {
  address: string;
  city: string;
  listPrice: number;
  mlsNumber: string;
  photoUrl: string | null;
}

export async function sendPropertyAlertEmail(
  to: string,
  userName: string,
  properties: AlertProperty[]
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[property-alert-email] SENDGRID_API_KEY is not set — skipping email send.");
    return;
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const count = properties.length;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cncrealtygroup.com";

  const propertyRows = properties
    .map((p) => {
      const price = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(p.listPrice);

      const link = `${baseUrl}/properties/${p.mlsNumber}`;
      const photoHtml = p.photoUrl
        ? `<img src="${p.photoUrl}" alt="${p.address}" width="200" style="display:block;border-radius:6px;margin-bottom:8px;max-width:100%;" />`
        : "";

      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #eee;">
            ${photoHtml}
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1B1B1B;">${p.address}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#666;">${p.city}</p>
            <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#9E8C61;">${price}</p>
            <a href="${link}" style="display:inline-block;background:#1B1B1B;color:#fff;text-decoration:none;padding:8px 16px;border-radius:20px;font-size:13px;">View Listing →</a>
          </td>
        </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New listings matching your search</title>
</head>
<body style="margin:0;padding:0;background:#F2F0EF;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F2F0EF;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1B1B1B;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#fff;">CnC Realty</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9E8C61;letter-spacing:1px;text-transform:uppercase;">Property Alerts</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1B1B1B;">Hi ${userName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444;">
                We found <strong>${count} new listing${count === 1 ? "" : "s"}</strong> matching your saved search:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${propertyRows}
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#999;">
                You&rsquo;re receiving this because you have property alerts turned on for a saved search.
                <a href="${baseUrl}/account" style="color:#9E8C61;">Manage your alerts</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F2F0EF;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#999;">
                &copy; ${new Date().getFullYear()} CnC Realty Group &bull; CA DRE #02439028
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sgMail.send({
    to,
    from: FROM,
    subject: `New listings matching your search`,
    html,
  });
}
