import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fair Housing Notice",
  description: "CnC Realty Group Fair Housing Notice — our commitment to equal housing opportunity under federal and California law.",
};

export default function FairHousingPage() {
  return (
    <div className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-4xl px-8 pt-32 pb-16 lg:px-16">
        <p className="mb-3 font-sans text-xs uppercase tracking-widest text-[#1B1B1B]/40">Legal</p>
        <h1 className="font-sans text-4xl font-light text-[#1B1B1B] lg:text-5xl">Fair Housing Notice</h1>
        <p className="mt-3 mb-12 font-sans text-sm text-[#1B1B1B]/50">CA DRE #02439028 · CnC Realty Group</p>
        <div className="space-y-12 font-sans text-[#1B1B1B]">

          <section>
            <p className="text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group is committed to the letter and spirit of U.S. and California fair housing law. We do not discriminate against any person in any aspect of the sale, rental, financing, or appraisal of residential real property on the basis of any characteristic protected by law.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Federal Fair Housing Act</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              The Federal Fair Housing Act (Title VIII of the Civil Rights Act of 1968, as amended) prohibits discrimination in the sale, rental, and financing of housing based on:
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Race</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Color</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />National Origin</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Religion</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Sex</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Familial Status</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Disability</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">California Fair Employment and Housing Act (FEHA)</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              California Government Code § 12955 et seq. extends fair housing protections to additional characteristics. Under California law, it is also unlawful to discriminate based on:
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Marital Status</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Ancestry</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Source of Income</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Sexual Orientation</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Gender Identity</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Gender Expression</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Age (40 and over)</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Genetic Information</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Immigration / Citizenship Status</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Military or Veteran Status</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#9E8C61] flex-shrink-0" />Primary Language</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Our Commitment</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              CnC Realty Group and all of its licensed agents are committed to equal housing opportunity. We do not and will not:
            </p>
            <ul className="space-y-2 text-base leading-relaxed text-[#1B1B1B]/80">
              <li>Refuse to sell or rent housing or make housing otherwise unavailable because of a protected characteristic.</li>
              <li>Set different terms, conditions, or privileges for the sale or rental of a dwelling based on any protected characteristic.</li>
              <li>Advertise or otherwise indicate any preference, limitation, or discrimination based on any protected characteristic.</li>
              <li>Represent that a property is not available when in fact it is, based on any protected characteristic.</li>
              <li>Engage in steering — directing buyers or renters toward or away from neighborhoods based on any protected characteristic.</li>
              <li>Refuse to make reasonable accommodations for persons with disabilities.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#1B1B1B]/80">
              All CnC agents adhere to the National Association of REALTORS® Code of Ethics Article 10, which also prohibits discriminatory practices.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Reporting Discrimination</h2>
            <p className="mb-3 text-base leading-relaxed text-[#1B1B1B]/80">
              If you believe you have experienced housing discrimination, you have the right to file a complaint. Complaints may be filed with:
            </p>
            <div className="space-y-6 text-base leading-relaxed text-[#1B1B1B]/80">
              <div>
                <p className="font-medium text-[#1B1B1B]">U.S. Department of Housing and Urban Development (HUD)</p>
                <p>Fair Housing Complaint Hotline: 1-800-669-9777</p>
                <p>Website: hud.gov/program_offices/fair_housing_equal_opp/online-complaint</p>
                <p>TTY: 1-800-927-9275</p>
              </div>
              <div>
                <p className="font-medium text-[#1B1B1B]">California Civil Rights Department (CRD)</p>
                <p>Formerly known as the Department of Fair Employment and Housing (DFEH)</p>
                <p>Hotline: 1-800-884-1684</p>
                <p>Website: calcivilrights.ca.gov</p>
              </div>
              <div>
                <p className="font-medium text-[#1B1B1B]">California Department of Real Estate (DRE)</p>
                <p>For complaints against a California licensed real estate agent or broker</p>
                <p>Website: dre.ca.gov</p>
                <p>Phone: 1-877-373-4542</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-sans text-xl font-medium text-[#1B1B1B]">Contact CnC Realty Group</h2>
            <p className="mb-4 text-base leading-relaxed text-[#1B1B1B]/80">
              If you have questions about fair housing or concerns about conduct by a CnC agent, please contact us directly:
            </p>
            <address className="not-italic text-base leading-loose text-[#1B1B1B]/80">
              <strong>CnC Realty Group</strong> — Designated Broker: Ryan Chong<br />
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
