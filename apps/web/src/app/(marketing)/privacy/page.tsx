import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "CnC Realty Group Privacy Policy — how we collect, use, and protect your personal information under California law.",
};

const EFFECTIVE_DATE = "June 15, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      {/* Page header */}
      <div className="bg-[#1B1B1B] px-8 pt-28 pb-16 lg:px-16">
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-white/40">Legal</p>
        <h1 className="font-sans text-4xl font-light text-white lg:text-5xl">Privacy Policy</h1>
        <p className="mt-4 font-sans text-sm text-white/50">Effective Date: {EFFECTIVE_DATE}</p>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-8 py-16 lg:px-16">
        <div className="space-y-12 font-sans text-[#1B1B1B]">

          <section>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group ("<strong>CnC</strong>," "we," "us," or "our"), a California licensed real estate brokerage (CA DRE #02439028), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you visit <strong>cncrealtygroup.com</strong> (the "Site") or engage with our services. This policy is intended to comply with the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act of 2020 ("CCPA/CPRA"), the California Online Privacy Protection Act ("CalOPPA"), and other applicable law.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              By using our Site, you consent to the practices described in this policy. If you do not agree, please do not use our Site.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">1. Information We Collect</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">We may collect the following categories of personal information:</p>
            <ul className="space-y-3 text-base leading-relaxed text-[#1B1B1B]/80">
              <li><strong>Identifiers:</strong> Name, email address, phone number, mailing address, IP address, and account credentials.</li>
              <li><strong>Professional or employment information:</strong> Real estate license number, brokerage affiliation, years of experience (for agents applying to join CnC).</li>
              <li><strong>Commercial information:</strong> Property listings you viewed, saved searches, saved properties, and home valuation requests.</li>
              <li><strong>Internet or network activity:</strong> Browser type, operating system, referring URLs, pages viewed, time spent on pages, and cookies or similar tracking data.</li>
              <li><strong>Communications data:</strong> Messages, tour requests, inquiries, and notes submitted through our contact forms.</li>
              <li><strong>Geolocation data:</strong> Approximate location inferred from IP address when you use map-based property search features.</li>
              <li><strong>Sensitive personal information:</strong> We do not intentionally collect Social Security numbers, financial account numbers, or medical information through our Site.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">2. How We Collect Information</h2>
            <ul className="space-y-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li><strong>Directly from you:</strong> When you create an account, submit a contact form, request a tour, request a home valuation, or apply to join CnC as an agent.</li>
              <li><strong>Automatically:</strong> Through cookies, web beacons, and similar tracking technologies when you browse our Site.</li>
              <li><strong>From third parties:</strong> We may receive information from our analytics providers (PostHog), error monitoring services (Sentry), and email service providers (SendGrid) in the ordinary course of operating our Site.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">3. How We Use Your Information</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">We use your personal information for the following purposes:</p>
            <ul className="space-y-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li>To provide and improve our real estate services, including property search, agent matching, and transaction management.</li>
              <li>To respond to your inquiries, tour requests, valuation requests, and agent contact forms.</li>
              <li>To send you property alerts, market updates, and promotional emails, where you have consented or provided your contact information in connection with a real estate transaction.</li>
              <li>To send you text messages (SMS) where you have provided express written consent as required by the Telephone Consumer Protection Act ("TCPA").</li>
              <li>To process agent onboarding applications and manage agent accounts.</li>
              <li>To analyze Site usage and improve our user experience.</li>
              <li>To comply with our legal and regulatory obligations as a California licensed brokerage.</li>
              <li>To prevent fraud, protect the security of our Site, and enforce our Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">4. SMS / Text Message Communications</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              We will only send you promotional or transactional text messages (SMS) if you have provided express written consent. By providing your phone number and checking any opt-in box on our Site, you consent to receive automated text messages from CnC Realty Group. Message and data rates may apply. You may opt out at any time by replying <strong>STOP</strong> to any text message we send, or by contacting us at <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">info@cncrealtygroup.com</a>. We do not share your mobile number with third parties for their marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">5. Cookies and Tracking Technologies</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              Our Site uses cookies and similar tracking technologies to improve your experience. CalOPPA requires us to disclose how we respond to "Do Not Track" signals: we currently do not alter our data collection practices in response to browser-based Do Not Track signals because there is no consensus on what such signals mean in this context. We offer a cookie consent banner through which California residents may decline analytics tracking.
            </p>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              You may disable cookies through your browser settings. Note that disabling cookies may affect the functionality of some Site features.
            </p>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              You may opt out of targeted advertising through industry opt-out programs such as the <strong>Network Advertising Initiative</strong> (optout.networkadvertising.org) or the <strong>Digital Advertising Alliance</strong> (optoutadtool.aboutads.info). On mobile devices, you may also adjust your device's privacy settings to limit ad tracking. Please note that opting out only applies to the specific browser or device from which you opt out.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">6. Sharing of Personal Information</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">We may share your personal information in the following circumstances:</p>
            <ul className="space-y-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li><strong>With our agents:</strong> Licensed CnC agents may receive your contact information to assist with your real estate needs.</li>
              <li><strong>With transaction service providers:</strong> As part of a real estate transaction, we may share your information with mortgage lenders, insurance brokers, title and escrow companies, and other parties you authorize.</li>
              <li><strong>With our service providers:</strong> We share data with vendors who assist us in operating our Site and business (e.g., cloud hosting, email delivery, analytics). These vendors are contractually prohibited from using your data for their own purposes.</li>
              <li><strong>With the California Regional MLS (CRMLS):</strong> Certain usage data may be shared to comply with IDX rules.</li>
              <li><strong>For legal compliance:</strong> We may disclose information as required by applicable law, court order, or government authority.</li>
              <li><strong>In business transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred to a successor entity.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              We do not sell your personal information to third parties for monetary consideration. However, we may share your information with analytics partners in a manner that may constitute a "sale" or "sharing" under the CCPA/CPRA. You have the right to opt out of such sharing — see Section 8 below.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">7. Email Marketing Opt-Out</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Every promotional email we send includes an unsubscribe link. If you elect to unsubscribe, we will remove you from the relevant email list within ten (10) business days. You may also opt out by contacting us at <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">info@cncrealtygroup.com</a>. Please note that you may continue to receive transactional communications related to an active real estate transaction even after opting out of marketing emails.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">8. Data Retention &amp; Account Deletion</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              We retain your personal information for as long as necessary to fulfill the purposes described in this policy, comply with our legal and regulatory obligations as a California licensed real estate brokerage (including DRE record-keeping requirements), resolve disputes, and enforce our agreements. When information is no longer needed, we delete or anonymize it.
            </p>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              You may delete your user account at any time by contacting us at <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">info@cncrealtygroup.com</a>. Please note that we may be required to retain certain information related to completed real estate transactions for regulatory compliance purposes even after account deletion.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">9. California Privacy Rights (CCPA/CPRA)</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              California residents have the following rights under the CCPA/CPRA with respect to their personal information:
            </p>
            <ul className="space-y-3 text-base leading-relaxed text-[#1B1B1B]/80">
              <li><strong>Right to Know:</strong> You may request a description of the categories and specific pieces of personal information we have collected about you, the sources, our purposes for using it, and the categories of third parties with whom we share it.</li>
              <li><strong>Right to Delete:</strong> You may request deletion of your personal information, subject to certain exceptions (e.g., information we are required to retain by law).</li>
              <li><strong>Right to Correct:</strong> You may request correction of inaccurate personal information we hold about you.</li>
              <li><strong>Right to Opt Out of Sale/Sharing:</strong> You may direct us not to sell or share your personal information with third parties. To exercise this right, visit our{" "}<Link href="/do-not-sell" className="text-[#9E8C61] underline underline-offset-2">Do Not Sell or Share My Personal Information</Link>{" "}page, or click "Decline" on our cookie consent banner.</li>
              <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> You may request that we limit our use of any sensitive personal information to purposes necessary to provide the services you request.</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA/CPRA rights.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              To submit a rights request, contact us at <a href="mailto:info@cncrealtygroup.com" className="text-[#9E8C61] underline underline-offset-2">info@cncrealtygroup.com</a> or by mail at the address below. We will respond within 45 days. We may need to verify your identity before fulfilling your request.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">10. CalOPPA Compliance</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              In compliance with California Business &amp; Professions Code § 22575–22579, this privacy policy is posted conspicuously on our Site, identifies the categories of personally identifiable information we collect and the third parties with whom we may share it, and describes the process for reviewing and updating personal information. We will notify users of material changes to this policy by updating the Effective Date above.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">11. Children</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Our Site is not intended for individuals under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have inadvertently collected information from a person under 18, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">12. Data Security</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, no data transmission or storage system is completely secure. If you believe your account security has been compromised, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">13. Third-Party Links</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Our Site may contain links to third-party websites, including social media platforms (Facebook, Instagram, YouTube) and lender websites. We are not responsible for the privacy practices of those websites. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">14. Governing Law</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              This Privacy Policy is governed by the laws of the State of California.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">15. Changes to This Policy</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the revised policy on this page with an updated Effective Date. Your continued use of our Site following notice of any changes constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">16. Contact Us</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              If you have questions about this Privacy Policy or wish to exercise your privacy rights, contact us at:
            </p>
            <address className="mt-4 not-italic text-base leading-loose text-[#1B1B1B]/80">
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
