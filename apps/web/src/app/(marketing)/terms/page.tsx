import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "CnC Realty Group Terms of Service — the rules governing your use of cncrealtygroup.com.",
};

const EFFECTIVE_DATE = "June 15, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-4xl px-8 pt-32 pb-16 lg:px-16">
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-[#1B1B1B]/40">Legal</p>
        <h1 className="font-sans text-4xl font-light text-[#1B1B1B] lg:text-5xl">Terms of Service</h1>
        <p className="mt-3 mb-12 font-sans text-sm text-[#1B1B1B]/50">Effective Date: {EFFECTIVE_DATE}</p>
        <div className="space-y-12 font-sans text-[#1B1B1B]">

          <section>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Please read these Terms of Service ("Terms") carefully before using <strong>cncrealtygroup.com</strong> (the "Site") operated by CnC Realty Group, a California licensed real estate brokerage (CA DRE #02439028) ("CnC," "we," "us," or "our"). By accessing or using the Site, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Site.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">1. Use of the Site</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              You may use the Site for lawful purposes only. You agree not to:
            </p>
            <ul className="space-y-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li>Use the Site in any way that violates any applicable federal, state, local, or international law or regulation.</li>
              <li>Scrape, crawl, spider, or otherwise harvest any content or data from the Site without our express written permission.</li>
              <li>Transmit or upload any material that is defamatory, obscene, fraudulent, harmful, or otherwise objectionable.</li>
              <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation with any person or entity.</li>
              <li>Interfere with or disrupt the integrity or performance of the Site or its related systems.</li>
              <li>Attempt to gain unauthorized access to any portion of the Site or its related systems or networks.</li>
              <li>Use the Site or property listings for any commercial purpose without our prior written consent, including redistribution of MLS data to a third party.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              We reserve the right to terminate your access to the Site at any time, for any reason, without notice.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">2. User Accounts</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              To access certain features of the Site (such as saving properties, requesting tours, or accessing the agent dashboard), you may create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. CnC is not liable for any loss or damage arising from your failure to maintain account security.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">3. Property Listings and MLS Data</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              Our Site displays property listings sourced from the California Regional MLS (CRMLS) through an IDX (Internet Data Exchange) feed. <strong>All listing information is deemed reliable but not guaranteed.</strong> You should independently verify all information, including but not limited to square footage, lot size, school districts, HOA fees, and property condition, before relying on it for any purpose.
            </p>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              Listing data is provided for your personal, non-commercial use only. Redistribution or retransmission of MLS data in any form, including but not limited to reproduction, copying, modification, or online display, without the prior written consent of the MLS or the listing broker is strictly prohibited.
            </p>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Property availability, pricing, and status are subject to change without notice. CnC makes no representation that any listed property is available for sale or lease, or that listing information is current, complete, or accurate.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">4. No Agency Relationship</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Use of the Site does not create an agency, brokerage, or fiduciary relationship between you and CnC Realty Group or any of its agents. An agency relationship is only established upon execution of a written representation agreement with a licensed CnC agent.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">5. Mortgage and Financial Information</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              The mortgage calculator and any financial estimates provided on the Site are for illustrative and informational purposes only. They do not constitute a loan commitment, pre-qualification, or guarantee of financing. Consult a licensed mortgage professional for advice specific to your financial situation.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">6. Intellectual Property</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              The Site and its original content, features, and functionality (including but not limited to text, graphics, logos, images, audio clips, and software) are owned by CnC Realty Group or its licensors and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws. You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any material from the Site without our prior written consent, except for personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">7. Third-Party Links and Services</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              The Site may contain links to third-party websites or services that are not owned or controlled by CnC. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services. We encourage you to review the terms and privacy policies of any third-party websites you visit.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">8. Disclaimer of Warranties</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              THE SITE AND ALL CONTENT, SERVICES, AND INFORMATION PROVIDED THROUGH THE SITE ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, CNC DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">9. Limitation of Liability</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CNC REALTY GROUP, ITS AFFILIATES, LICENSORS, SERVICE PROVIDERS, EMPLOYEES, AGENTS, OFFICERS, OR DIRECTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (i) YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SITE; (ii) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SITE; (iii) ANY CONTENT OBTAINED FROM THE SITE; OR (iv) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">10. Indemnification</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              You agree to defend, indemnify, and hold harmless CnC Realty Group, its affiliates, licensors, and service providers, and its and their respective officers, directors, employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use of the Site.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">11. Governing Law and Dispute Resolution</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Site shall be resolved in the state or federal courts located in Los Angeles County, California, and you irrevocably consent to the personal jurisdiction of such courts.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">12. Changes to Terms</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              We reserve the right to modify these Terms at any time. We will post the revised Terms on this page with an updated Effective Date. Your continued use of the Site after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">13. Contact Us</h2>
            <address className="not-italic text-base leading-loose text-[#1B1B1B]/80">
              <strong>CnC Realty Group</strong><br />
              Los Angeles, CA<br />
              Email: <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">info@cncrealtygroup.com</a><br />
              CA DRE #02439028
            </address>
          </section>

        </div>
      </div>
    </div>
  );
}
