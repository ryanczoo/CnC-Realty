import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DMCA Notice",
  description: "CnC Realty Group DMCA Notice — how to report copyright infringement and our Digital Millennium Copyright Act policy.",
};

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      <div className="bg-[#1B1B1B] px-8 pt-28 pb-16 lg:px-16">
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-white/40">Legal</p>
        <h1 className="font-sans text-4xl font-light text-white lg:text-5xl">DMCA Notice</h1>
        <p className="mt-4 font-sans text-sm text-white/50">Digital Millennium Copyright Act Policy</p>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-16 lg:px-16">
        <div className="space-y-12 font-sans text-[#1B1B1B]">

          <section>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group respects the intellectual property rights of others and expects users of cncrealtygroup.com (the "Site") to do the same. In accordance with the Digital Millennium Copyright Act of 1998 (17 U.S.C. § 512) ("DMCA"), we will respond expeditiously to claims of copyright infringement.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Designated DMCA Agent</h2>
            <p className="mb-4 text-base leading-relaxed text-[#1B1B1B]/80">
              Our designated agent for notice of alleged copyright infringement on the Site is:
            </p>
            <address className="not-italic rounded-xl border border-[#1B1B1B]/10 bg-white p-6 text-base leading-loose text-[#1B1B1B]/80">
              <strong>DMCA Agent — CnC Realty Group</strong><br />
              Attn: Copyright Agent<br />
              Los Angeles, CA<br />
              Email: <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">info@cncrealtygroup.com</a><br />
              CA DRE #02439028
            </address>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Submitting a Takedown Notice</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              If you believe that content on our Site infringes your copyright, please submit a written takedown notice to our Designated DMCA Agent. To be valid, your notice must include <strong>all</strong> of the following under 17 U.S.C. § 512(c)(3):
            </p>
            <ol className="space-y-3 list-decimal list-outside pl-5 text-base leading-relaxed text-[#1B1B1B]/80">
              <li>A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</li>
              <li>Identification of the copyrighted work you claim has been infringed (or, if multiple works are covered by a single notice, a representative list of such works).</li>
              <li>Identification of the material on our Site that you claim is infringing, with information reasonably sufficient to permit us to locate it (e.g., URL).</li>
              <li>Your contact information, including your address, telephone number, and email address.</li>
              <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement that the information in the notification is accurate, and, <strong>under penalty of perjury</strong>, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            </ol>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              Please be aware that under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material or activity is infringing may be subject to liability.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Counter-Notification</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              If you believe material was removed or disabled by mistake or misidentification, you may submit a counter-notification to our Designated DMCA Agent. Your counter-notification must include:
            </p>
            <ol className="space-y-3 list-decimal list-outside pl-5 text-base leading-relaxed text-[#1B1B1B]/80">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that has been removed or disabled and the location at which it appeared before removal or disabling.</li>
              <li>A statement under penalty of perjury that you have a good faith belief that the material was removed or disabled as a result of mistake or misidentification.</li>
              <li>Your name, address, telephone number, and email address.</li>
              <li>A statement that you consent to the jurisdiction of the Federal District Court for the judicial district in which your address is located (or, if outside the U.S., for any judicial district in which CnC Realty Group may be found), and that you will accept service of process from the person who provided the original infringement notification.</li>
            </ol>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              Upon receipt of a valid counter-notification, we will forward it to the original complainant and may restore the removed material in 10–14 business days unless the copyright owner files a court action during that time.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Repeat Infringer Policy</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group will, in appropriate circumstances and in its sole discretion, disable and/or terminate the accounts of users who are determined to be repeat infringers.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
