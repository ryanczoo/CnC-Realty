import type { Metadata } from "next";
import { RevealLine } from "@/components/ui/reveal-text";
import { PageCTA } from "@/components/ui/PageCTA";
import { ConfettiCannon } from "@/components/join/ConfettiCannon";

export const metadata: Metadata = {
  title: "Application Submitted | CnC Realty",
  description: "Next steps after submitting your CnC Realty agent application.",
};

export default function ApplicationSubmittedPage() {
  return (
    <main className="relative min-h-screen bg-[#F2F0EF]">
      <ConfettiCannon />
      <div className="mx-auto max-w-4xl px-4 pt-32 pb-8">
        <h1 className="-ml-40 mb-12 font-sans font-light leading-[1.05]">
          <span className="block text-[1.9rem] xl:text-[2.2rem] text-[#1B1B1B]">
            <RevealLine delay={0}>You&apos;re</RevealLine>
          </span>
          <span className="ml-[3rem] block text-[3rem] xl:ml-[4rem] xl:text-[3.6rem]">
            <RevealLine delay={0.15}>
              <span className="font-medium text-[#9E8C61]">IN</span>
            </RevealLine>
          </span>
        </h1>

        <div className="space-y-9 text-center font-sans text-xl leading-relaxed text-[#1B1B1B]/80">
          <p>Congrats on taking a smart step forward in your career!</p>

          <p>While we are approving your application, please complete this last step to join CnC:</p>

          <ol className="mx-auto w-fit list-inside list-decimal space-y-4 text-left">
            <li>
              Login to your{" "}
              <a
                href="https://secure.dre.ca.gov/elicensing/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9E8C61] underline"
              >
                DRE eLicensing account
              </a>
            </li>
            <li>Select &quot;Change Responsible Broker/Add Responsible Broker.&quot;</li>
            <li>
              Select <span className="font-semibold text-[#1B1B1B]">No</span> for &quot;Is the
              broker available to certify your acceptance now?&quot;
            </li>
            <li>
              Enter{" "}
              <span className="font-semibold text-[#1B1B1B]">info@cncrealtygroup.com</span>{" "}
              for Broker&apos;s email address
            </li>
            <li>
              Enter <span className="font-semibold text-[#1B1B1B]">02439028</span> for
              Broker&apos;s license #
            </li>
          </ol>

          <p>
            Once completed, we will certify your request and send you a welcome email.
          </p>
        </div>
      </div>

      <PageCTA
        heading={<>Now We&apos;re <span className="text-cnc-gold font-medium">Talking</span></>}
        primaryHref="/"
        primaryLabel="Home"
        secondaryLabel="Message"
        showContactModal
        contactSource="APPLY_SUBMITTED_CTA"
      />
    </main>
  );
}
