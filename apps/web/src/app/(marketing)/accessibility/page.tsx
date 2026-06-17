import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "CnC Realty Group's commitment to web accessibility and how to contact us if you experience difficulty accessing our website.",
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      {/* Content */}
      <div className="mx-auto max-w-4xl px-8 pt-32 pb-16 lg:px-16">
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-[#1B1B1B]/40">Legal</p>
        <h1 className="mb-12 font-sans text-4xl font-light text-[#1B1B1B] lg:text-5xl">Accessibility</h1>
        <div className="space-y-10 font-sans">

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Our Commitment</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group is committed to making our website accessible to all users, including those with disabilities. We strive to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1, Level AA</strong> — the widely accepted standard for web accessibility — and we continually work to improve the experience for everyone.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Known Limitations</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              While we work toward full WCAG 2.1 AA conformance, some areas of our website may not yet fully meet this standard. We are actively working to identify and address any gaps. If you encounter a specific barrier, please let us know using the contact information below and we will prioritize a fix.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Assistive Technology</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Our website is designed to be compatible with common assistive technologies, including screen readers, keyboard-only navigation, and browser zoom. If you use assistive technology and experience difficulty accessing any content on our site, please contact us and describe the issue in as much detail as possible — including the assistive technology you use and the page or feature that caused difficulty.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Contact Us</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              If you are experiencing difficulty accessing any content on our website because of a disability, or if you have suggestions for how we can improve accessibility, please reach out to us. We will do our best to provide you with the information or assistance you need in an accessible format.
            </p>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Email:{" "}
              <a
                href="mailto:info@cncrealtygroup.com"
                className="text-[#9E8C61] underline underline-offset-2"
              >
                info@cncrealtygroup.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Ongoing Efforts</h2>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              Accessibility is an ongoing effort. As we add new content and features to our website, we are committed to ensuring they meet the same accessibility standards. We welcome feedback from all users and use it to prioritize improvements.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
