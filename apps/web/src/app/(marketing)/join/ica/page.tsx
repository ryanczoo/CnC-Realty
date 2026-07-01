import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Independent Contractor Agreement | CnC Realty Group",
  description: "CnC Realty Group Independent Contractor Agreement for licensed real estate agents.",
};

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">
        {num}. {title}
      </h2>
      <div className="space-y-3 font-sans text-sm leading-relaxed text-[#1B1B1B]/80">
        {children}
      </div>
    </section>
  );
}

function Sub({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p><span className="font-semibold text-[#1B1B1B]">{id}.</span> {children}</p>
  );
}

function FeeTable() {
  const rows = [
    ["$0 – $1,000,000", "$0", "$990"],
    ["$1,000,001 – $1,500,000", "$200", "$1,190"],
    ["$1,500,001 – $2,000,000", "$400", "$1,390"],
    ["$2,000,001 – $2,500,000", "$600", "$1,590"],
    ["$2,500,001 – $3,000,000", "$800", "$1,790"],
    ["$3,000,001 – $3,500,000", "$1,000", "$1,990"],
    ["$3,500,001 – $4,000,000", "$1,200", "$2,190"],
    ["$4,000,001+", "+$200 per additional $500k", "$2,190 + supplement"],
  ];
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/15 bg-[#1B1B1B]/5">
            <th className="py-2 pr-4 text-left font-semibold text-[#1B1B1B]">Sale / Lease Price</th>
            <th className="py-2 pr-4 text-left font-semibold text-[#1B1B1B]">E&amp;O Supplement</th>
            <th className="py-2 text-left font-semibold text-[#1B1B1B]">Total Broker Fee</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([price, supp, total]) => (
            <tr key={price} className="border-b border-[#1B1B1B]/10">
              <td className="py-2 pr-4 text-[#1B1B1B]/80">{price}</td>
              <td className="py-2 pr-4 text-[#1B1B1B]/80">{supp}</td>
              <td className="py-2 font-semibold text-[#1B1B1B]">{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable() {
  const rows = [
    ["Transaction Fee (base, all transactions)", "$990"],
    ["E&O included through", "$1,000,000 sale/lease price"],
    ["E&O Supplement — per $500k (or fraction) over $1M", "$200"],
    ["E&O Supplement examples: $1M–$1.5M / $1.5M–$2M / $2M–$2.5M", "+$200 / +$400 / +$600"],
    ["Dual Agency / Agent-Relative Sale", "Full fee (base + supplement) × 2"],
    ["Broker-Provided Lead (referral fee)", "25% of gross commission + flat transaction fee"],
    ["Monthly Fee", "$0"],
    ["Optional CnC TC Service", "$350 (paid through escrow)"],
    ["E&O Insurance", "Included in transaction fee"],
    ["E&O Deductible (if claim)", "Associate-Licensee's responsibility"],
  ];
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/15 bg-[#1B1B1B]/5">
            <th className="py-2 pr-4 text-left font-semibold text-[#1B1B1B]">Item</th>
            <th className="py-2 text-left font-semibold text-[#1B1B1B]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([item, amount]) => (
            <tr key={item} className="border-b border-[#1B1B1B]/10">
              <td className="py-2 pr-4 text-[#1B1B1B]/80">{item}</td>
              <td className="py-2 font-medium text-[#1B1B1B]">{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IcaPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-3xl px-6 py-20">

        {/* Draft banner */}
        <div className="mb-10 rounded-lg border border-[#9E8C61]/40 bg-[#9E8C61]/8 px-4 py-3 font-sans text-xs text-[#9E8C61]">
          DRAFT — Pending attorney review. This document is provided for informational purposes only and does not constitute legal advice.
        </div>

        {/* Header */}
        <div className="mb-10 border-b border-[#1B1B1B]/15 pb-8">
          <p className="mb-1 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">CnC Realty Group</p>
          <h1 className="font-sans text-3xl font-light text-[#1B1B1B]">Independent Contractor Agreement</h1>
          <p className="mt-4 font-sans text-sm leading-relaxed text-[#1B1B1B]/60">
            This Independent Contractor Agreement (&ldquo;Agreement&rdquo;) is made between{" "}
            <strong className="text-[#1B1B1B]">CnC Realty Group</strong> (DRE License No. ___________) (&ldquo;Broker&rdquo;), and{" "}
            <strong className="text-[#1B1B1B]">Associate-Licensee</strong>. In consideration of the covenants and representations contained in this Agreement, Broker and Associate-Licensee agree as follows:
          </p>
        </div>

        {/* Sections */}
        <Section num="1" title="Broker">
          <p>Broker is duly licensed in the State of California as a real estate broker. Broker represents that Broker shall keep all licenses current during the term of this Agreement.</p>
        </Section>

        <Section num="2" title="Associate-Licensee">
          <p>Associate-Licensee represents that he or she is duly licensed by the State of California as a real estate broker or salesperson (DRE License No. ___________). Associate-Licensee shall keep all applicable license(s), continuing education, and provisional license requirements current during the term of this Agreement. Associate-Licensee shall notify Broker immediately of any change to, suspension of, or revocation of their license.</p>
        </Section>

        <Section num="3" title="Broker and Associate-Licensee Relationship">
          <Sub id="3.1">Broker and Associate-Licensee are independent contracting parties. This Agreement does not constitute an employment agreement by either party, nor shall it be construed as a partnership. Broker shall not be liable for any obligation, injury, disability, or liability incurred by Associate-Licensee.</Sub>
          <Sub id="3.2">Associate-Licensee agrees to follow the terms outlined in this Agreement, as well as CnC Realty Group&rsquo;s Office Policy Manual and Agent Resource materials published on the CnC Realty Group platform.</Sub>
          <Sub id="3.3">Associate-Licensee may solicit and obtain listings and sales of real estate for the mutual benefit of both parties. Associate-Licensee agrees to comply with all applicable laws, DRE regulations, and the ethical and professional standards of the California Association of REALTORS® and the National Association of REALTORS®. Associate-Licensee agrees to refrain from any act for which the Real Estate Commissioner of the State of California is authorized to suspend or revoke a real estate license.</Sub>
          <Sub id="3.4">Broker shall not limit Associate-Licensee&rsquo;s activities to geographical areas or the manner in which services are performed, except to the extent required by applicable laws, regulations, agreements, and procedures.</Sub>
          <Sub id="3.5">All lawful actions taken pursuant to this Agreement shall be taken in the name of Broker. Associate-Licensee agrees to contribute all rights and title to any listings to Broker for the benefit and use of Broker, Associate-Licensee, and other licensees of Broker. Associate-Licensee must provide Broker with a complete transaction file for each closing, including all required documentation per Broker&rsquo;s published checklists.</Sub>
          <Sub id="3.6">Associate-Licensee shall have no authority to bind Broker by any promises or representations, and Broker shall not be liable for any obligation or liability incurred by Associate-Licensee unless Broker has specifically authorized the same in writing.</Sub>
        </Section>

        <Section num="4" title="Independent Contractor Status / Tax">
          <Sub id="4.1">Associate-Licensee is an independent contractor for all purposes, including state and federal tax purposes. Broker will NOT withhold income taxes or Social Security from Associate-Licensee&rsquo;s compensation. Associate-Licensee is solely responsible for payment of all taxes and Social Security contributions. Associate-Licensee will receive an IRS Form 1099-NEC at the end of each calendar year in which Broker paid commissions on Associate-Licensee&rsquo;s behalf.</Sub>
          <Sub id="4.2">Associate-Licensee is not entitled to unemployment insurance as a result of this Agreement. Broker will provide workers&rsquo; compensation insurance for Broker&rsquo;s own benefit; this fact shall not create an inference of employment.</Sub>
        </Section>

        <Section num="5" title="Business Expenses">
          <p>Broker shall not be liable to Associate-Licensee for any expenses incurred in the performance of this Agreement. Associate-Licensee is responsible for all professional licenses, dues, MLS fees, Realtor® association fees, marketing materials, technology subscriptions, and any other costs of doing business. Broker shall not provide office space, supplies, or advertising materials unless otherwise agreed to in writing.</p>
        </Section>

        <Section num="6" title="Licensed Activity">
          <p>Associate-Licensee shall be familiar with and comply with all applicable laws, policies, and procedures, including but not limited to anti-discrimination laws, RESPA, the California Business and Professions Code, and all DRE regulations. Associate-Licensee agrees to indemnify Broker against any commissions that may be subject to refund, rebate, or reimbursement by court order or arbitration panel.</p>
          <p className="font-semibold text-[#1B1B1B]">Written approval from Broker is required before Associate-Licensee may conduct any of the following:</p>
          <ul className="ml-4 list-disc space-y-1 text-[#1B1B1B]/80">
            <li>Sale of Associate-Licensee&rsquo;s personal or family-owned property where Associate-Licensee also acts as agent</li>
            <li>Dual agency transactions</li>
            <li>Short sale negotiations where Associate-Licensee is not the listing agent and fees for negotiation are being charged</li>
          </ul>
          <p className="font-semibold text-[#1B1B1B]">The following activities are prohibited:</p>
          <ul className="ml-4 list-disc space-y-1 text-[#1B1B1B]/80">
            <li>Property management (unless Associate-Licensee is listed on title or has separate written approval)</li>
            <li>Loan modifications</li>
            <li>Reverse mortgages</li>
            <li>Accepting advance fees from clients of any kind</li>
          </ul>
        </Section>

        <Section num="7" title="Compensation / Broker Fees">
          <Sub id="7.1"><strong>Compensation Structure.</strong> Compensation shall be charged to the parties who enter into listing or buyer agreements for services requiring a real estate license. Associate-Licensee may use its own discretion regarding the commission fee to charge its clients, subject to the minimum fee described below. Broker&rsquo;s fee shall be deducted at closing before disbursement to Associate-Licensee.</Sub>
          <Sub id="7.2"><strong>Flat Transaction Fee.</strong> Broker&rsquo;s flat fee per closed transaction is <strong>$990</strong>, inclusive of Errors &amp; Omissions (E&amp;O) insurance coverage as described in Section 9 for sale or lease values up to and including $1,000,000. For transactions exceeding $1,000,000, an E&amp;O Supplement is added to the base fee.</Sub>
          <p className="font-semibold text-[#1B1B1B]">E&amp;O Supplement: $200 per $500,000 (or fraction thereof) of sale or lease price over $1,000,000.</p>
          <FeeTable />
          <p>No monthly fee is charged.</p>
          <Sub id="7.3"><strong>Associate-Licensee Commission.</strong> After deduction of the flat transaction fee, 100% of the remaining commission is disbursed to Associate-Licensee. Associate-Licensee may receive commission directly from escrow, provided that: (a) the completed transaction file was submitted for Broker&rsquo;s review no later than two (2) business days before close of escrow, and (b) Broker has certified the file as complete. Unauthorized release of a commission check is grounds for immediate termination.</Sub>
          <Sub id="7.4"><strong>Dual Agency and Agent-Relative Sales.</strong> Any transaction in which Associate-Licensee represents both buyer and seller (or both landlord and tenant) is counted as two (2) separate transactions for fee purposes. The full transaction fee — including the base flat fee and any applicable E&amp;O Supplement — shall be charged twice: once for the buyer-side representation and once for the seller-side representation. The same double-fee structure applies to transactions involving the sale or purchase of property owned by or for the benefit of Associate-Licensee, Associate-Licensee&rsquo;s immediate family member, or any entity in which Associate-Licensee holds an ownership interest, where Associate-Licensee also acts as the representing agent. Written approval from Broker is required for all such transactions per Section 6.</Sub>
          <Sub id="7.5"><strong>Referral and Lease Transactions.</strong> The flat transaction fee applies to referrals, leases, and any other transaction for which a real estate license is required. Broker&rsquo;s fee on referral or lease transactions is the flat fee applicable to the transaction value, or $950 minimum, whichever applies.</Sub>
          <Sub id="7.6"><strong>Minimum Fee.</strong> If a transaction closes at a commission amount less than the applicable flat fee, Associate-Licensee is responsible for remitting the balance of Broker&rsquo;s fee to Broker at closing.</Sub>
          <Sub id="7.7"><strong>Commission Advances.</strong> Broker does not offer commission advances. All commissions are paid after close of escrow and file certification.</Sub>
          <Sub id="7.8"><strong>Deductions.</strong> Broker may deduct from Associate-Licensee&rsquo;s commission any actual and pending reasonable expenses arising from Associate-Licensee&rsquo;s activity, including but not limited to: legal expenses, MLS/board dues paid on Associate-Licensee&rsquo;s behalf, repayment of any advance, and judgments or settlements. This paragraph applies regardless of whether Associate-Licensee is at fault and whether the matter has been adjudicated.</Sub>
          <Sub id="7.9"><strong>Broker-Provided Leads.</strong> For any transaction that closes as a direct result of a lead provided by Broker, Associate-Licensee shall remit to Broker a referral fee equal to twenty-five percent (25%) of Associate-Licensee&rsquo;s gross commission on that transaction, in addition to the applicable flat transaction fee. The referral fee shall be deducted from Associate-Licensee&rsquo;s commission at closing. Broker will identify leads as &ldquo;Broker-provided&rdquo; in writing at the time of referral.</Sub>
          <Sub id="7.10"><strong>Post-Termination Compensation.</strong> Upon termination of this Agreement, payments shall cease; provided that Associate-Licensee shall be entitled to commissions for transactions closed prior to the termination date for which Associate-Licensee has not yet been paid, so long as Associate-Licensee is not in default of this Agreement. Broker may deduct all financial obligations owed to Broker from any commissions due at termination. If pending transactions require further work normally rendered by Associate-Licensee, Broker may assign another licensee to complete the work, and reasonable compensation to the completing licensee shall be deducted from the terminating Associate-Licensee&rsquo;s commission share.</Sub>
        </Section>

        <Section num="8" title="Optional CnC TC Service">
          <Sub id="8.1">CnC Realty Group offers an optional Transaction Coordinator (&ldquo;TC&rdquo;) service for an additional fee of <strong>$350 per transaction</strong>, payable by the client through escrow at closing. This service is strongly recommended and includes document collection, deadline tracking, and compliance review by a licensed CnC TC coordinator.</Sub>
          <Sub id="8.2">Use of the CnC TC Service is voluntary. Associate-Licensee may use any licensed TC of their choosing, or may self-coordinate, provided all required documentation is submitted to Broker&rsquo;s platform within required timelines.</Sub>
          <Sub id="8.3">Broker reserves the right to require use of the CnC TC Service for any transaction in which Associate-Licensee has demonstrated a pattern of non-compliance with file submission deadlines or document requirements. In such cases, the $350 fee will be charged to the transaction regardless of client consent.</Sub>
          <Sub id="8.4">The CnC TC Service fee is separate from and in addition to the flat transaction fee described in Section 7.2.</Sub>
        </Section>

        <Section num="9" title="Errors &amp; Omissions Insurance">
          <Sub id="9.1">Broker maintains an Errors &amp; Omissions (E&amp;O) insurance policy covering real estate transactions brokered through CnC Realty Group. Coverage limits are $1,000,000 per claim and $1,000,000 aggregate. The flat transaction fee described in Section 7.2 includes E&amp;O coverage for transactions with a sale or lease value up to and including $1,000,000. For transactions exceeding $1,000,000, the E&amp;O Supplement described in Section 7.2 covers the additional E&amp;O exposure — no further E&amp;O fee is charged beyond what is specified in the fee schedule.</Sub>
          <Sub id="9.2">Associate-Licensee is responsible for any deductible that may be assessed against a claim arising from Associate-Licensee&rsquo;s transaction(s). Broker&rsquo;s E&amp;O policy does not cover: personal property transactions by Associate-Licensee (where Associate-Licensee is buying or selling their own property), prohibited activities listed in Section 6, or conduct found by a court or arbitration panel to constitute intentional fraud, misrepresentation, or gross negligence.</Sub>
          <Sub id="9.3">Associate-Licensee must receive written approval from Broker before filing any E&amp;O claim. Unauthorized claims will result in Associate-Licensee being solely responsible for the deductible.</Sub>
        </Section>

        <Section num="10" title="Transaction Management &amp; Activity Reporting">
          <Sub id="10.1">Associate-Licensee shall report all real estate activities to Broker within 48 hours of occurrence. Real estate activities include: listing agreements, newly opened escrows, accepted purchase agreements, cancelled or expired agreements, referral fee agreements, and any other business contract involving Associate-Licensee and a client.</Sub>
          <Sub id="10.2">Proper reporting requires Associate-Licensee to open a new transaction record in CnC Realty Group&rsquo;s transaction management platform and upload all required documents per Broker&rsquo;s checklist. <strong>For dual agency transactions, Associate-Licensee must create two (2) separate transaction records — one for the listing/seller side and one for the buyer side.</strong></Sub>
          <Sub id="10.3">Commission will not be released until Associate-Licensee has created a complete transaction record in the CnC platform and Broker has certified the file as complete. Closing a transaction without an open and certified transaction record is grounds for withholding of commission until the deficiency is corrected.</Sub>
        </Section>

        <Section num="11" title="Documents and Files">
          <p>All files and documents pertaining to listings, leads, and transactions are the property of Broker and shall be delivered to Broker in the manner and within the timeframe specified in Broker&rsquo;s Office Policy Manual. Associate-Licensee is responsible for ensuring that all required documentation, agent credits, and signatures are completed prior to recording. No corrective actions will be permitted after recording.</p>
        </Section>

        <Section num="12" title="Trust Fund (Earnest Money) Handling">
          <p>In accordance with the California Business and Professions Code and Commissioner&rsquo;s Regulations, trust funds received by Associate-Licensee must be placed into a neutral escrow depository (escrow or title company) or a trust account maintained by Broker, no later than three (3) business days after receipt. Associate-Licensee shall not accept earnest money deposits in Associate-Licensee&rsquo;s personal or business name, and shall not accept cash payments from clients. Associate-Licensee agrees to follow Broker&rsquo;s instructions regarding earnest money handling as published on the CnC Realty Group platform.</p>
        </Section>

        <Section num="13" title="Fictitious Business Names and Logos">
          <p>While affiliated with Broker, Associate-Licensee shall use Broker&rsquo;s name and corresponding logo on signage, stationery, websites, and any other marketing materials, unless Associate-Licensee has a separate written DBA agreement with Broker filed with the California DRE. Associate-Licensee agrees to discontinue use of Broker&rsquo;s trademark, logo, and graphics immediately upon termination of this Agreement.</p>
        </Section>

        <Section num="14" title="Advertising and Solicitations">
          <p>All advertising done by Associate-Licensee on behalf of Broker must receive prior written approval from Broker. No telephone solicitation is permitted to persons registered on a national or state do-not-call registry. Broker is not liable for advertising done by Associate-Licensee, and Associate-Licensee agrees to indemnify and hold Broker harmless for any costs or damages arising from Associate-Licensee&rsquo;s failure to comply with applicable advertising laws.</p>
        </Section>

        <Section num="15" title="Liability / Indemnity / Fraud and Misrepresentation">
          <Sub id="15.1">Associate-Licensee shall indemnify and hold Broker and its owner(s), affiliates, directors, officers, agents, employees, successors, and assigns harmless from any and all losses, damages, demands, claims, liabilities, costs, and expenses (including reasonable attorney fees) incurred by reason of or arising out of any fraud, misrepresentation, or negligence by Associate-Licensee, including misrepresentation of Associate-Licensee&rsquo;s relationship with Broker to any third party.</Sub>
          <Sub id="15.2">Associate-Licensee agrees to pay, reimburse, or otherwise be liable to Broker for any reasonable legal expenses, court fees, damages, and representation costs resulting from Associate-Licensee&rsquo;s real estate transactions or affiliation with Broker, regardless of whether such transactions produced commissions.</Sub>
          <Sub id="15.3">Associate-Licensee agrees to cooperate fully with Broker in the defense of any claim or controversy arising from Associate-Licensee&rsquo;s transactions or affiliation, including providing testimony, documents, and any other reasonable assistance requested by Broker or Broker&rsquo;s counsel.</Sub>
          <Sub id="15.4">In the event legal action is necessary to enforce payment, liability, or indemnity terms of this Agreement, Associate-Licensee agrees Broker shall be entitled to collect any judgment or settlement due, plus reasonable attorney fees, court costs, and other enforcement expenses.</Sub>
        </Section>

        <Section num="16" title="Injuries to Associate-Licensee">
          <p>Associate-Licensee acknowledges that Broker does not provide workers&rsquo; compensation insurance for Associate-Licensee&rsquo;s benefit as Associate-Licensee is an independent contractor. Associate-Licensee is responsible for obtaining appropriate insurance coverage for Associate-Licensee and Associate-Licensee&rsquo;s employees, if any. Associate-Licensee and Associate-Licensee&rsquo;s employees waive any rights to recovery from Broker for injuries sustained while performing services under this Agreement.</p>
        </Section>

        <Section num="17" title="Automobile Insurance">
          <p>Associate-Licensee shall maintain automobile insurance coverage for liability and property damage in the minimum amounts required by California law. Associate-Licensee agrees to indemnify Broker against any claims or demands resulting from any automobile accident involving Associate-Licensee.</p>
        </Section>

        <Section num="18" title="Security and Cyber Fraud">
          <p>Associate-Licensee is responsible for the security of their personal computer and digital accounts. Associate-Licensee shall not allow any attorney, title company, or escrow company to send wiring instructions to Associate-Licensee for forwarding to clients. All wiring instructions must be sent directly to clients from the title or escrow company. If Associate-Licensee suspects a fraudulent or cyber-security incident involving a client transaction, Associate-Licensee shall notify Broker within 24 hours.</p>
        </Section>

        <Section num="19" title="Working Place">
          <p>Broker does not provide office space for Associate-Licensee. Associate-Licensee may work from home, personal office, or any other location of Associate-Licensee&rsquo;s choice. Associate-Licensee must store all transaction documents securely and be able to present them to Broker within 24 hours of request. Associate-Licensee must be accessible by phone and email and maintain current contact information in the CnC Realty Group platform.</p>
        </Section>

        <Section num="20" title="Confidential Information and Non-Disclosure">
          <p>Associate-Licensee will have access to confidential information owned by Broker, including client data, proprietary systems, and business processes. Associate-Licensee shall keep all confidential information strictly confidential during the term of this Agreement and after termination, and shall not use such information for any purpose other than performance of this Agreement.</p>
        </Section>

        <Section num="21" title="Termination of Agreement">
          <p>This Agreement may be terminated by either party, at any time, with or without cause, upon written notice. Even after termination, this Agreement shall govern all disputes and claims between Broker and Associate-Licensee connected with their relationship under this Agreement. Upon termination, Associate-Licensee shall immediately cease use of Broker&rsquo;s name, logo, and trademarks.</p>
        </Section>

        <Section num="22" title="Dispute Resolution">
          <p>The parties agree to attempt mediation before initiating arbitration or litigation. Any disputes or claims between Broker and Associate-Licensee that cannot be resolved by negotiation shall be submitted to binding arbitration pursuant to the rules of the California Association of REALTORS® or the American Arbitration Association. This Agreement is governed by the laws of the State of California. Jurisdiction and venue shall be in the County of Los Angeles, California.</p>
        </Section>

        <Section num="23" title="Associate-Licensee's Employees">
          <p>Associate-Licensee may employ personal assistants provided that: (a) there is a written agreement between Associate-Licensee and the personal assistant outlining all terms, compensation, supervision, and compliance responsibilities; and (b) if the personal assistant holds a California real estate license, a copy of that license is provided to Broker. Associate-Licensee is responsible for supervising personal assistants and ensuring their compliance with all terms of this Agreement.</p>
        </Section>

        <Section num="24" title="Mentorship Program">
          <Sub id="24.1">CnC Realty Group offers an optional Mentorship Program for Associate-Licensees with little or no transactional experience. Participation in the Mentorship Program requires a separate written Mentorship Agreement signed by the Associate-Licensee, the assigned Mentor, and Broker.</Sub>
          <Sub id="24.2">Under the Mentorship Program, the commission split is <strong>70% to Associate-Licensee and 30% to the assigned Mentor</strong>. The flat transaction fee (Section 7.2) and the CnC TC Service fee (Section 8, if applicable) are deducted from the gross commission <strong>before</strong> the 70/30 split is applied.</Sub>
          <Sub id="24.3">The 70/30 mentorship split applies to <strong>both sides</strong> of any dual agency transaction. If Associate-Licensee represents both buyer and seller while enrolled in the Mentorship Program, the mentorship split applies to each side separately.</Sub>
          <Sub id="24.4">Upon successful completion of the Associate-Licensee&rsquo;s first closed transaction under the Mentorship Program, the Associate-Licensee will transition to 100% commission (less the applicable flat transaction fee) for all subsequent transactions, unless otherwise agreed in writing.</Sub>
        </Section>

        <Section num="25" title="Entire Agreement">
          <p>This Agreement, together with CnC Realty Group&rsquo;s Office Policy Manual (incorporated herein by reference), constitutes the entire agreement of the parties regarding Associate-Licensee&rsquo;s affiliation with Broker. There are no other promises or conditions not set forth in writing herein. This Agreement supersedes all prior written or verbal agreements between the parties. This Agreement may be modified only by a written amendment signed by both parties. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall remain valid and enforceable.</p>
        </Section>

        <Section num="26" title="Associate-Licensee Agrees and Understands That">
          <ul className="ml-4 list-disc space-y-2 text-[#1B1B1B]/80">
            <li>CnC Realty Group&rsquo;s Office Policy Manual contains important policies. Associate-Licensee is advised to read, understand, and follow all policies. Broker may update policies with or without prior notice.</li>
            <li>Associate-Licensee agrees to all fees and charges set forth in this Agreement. The fee schedule in effect at the time a transaction is initiated applies to that transaction.</li>
            <li>Associate-Licensee&rsquo;s electronic or written signature below confirms that Associate-Licensee has read this Agreement and agrees to abide by its provisions.</li>
          </ul>
        </Section>

        {/* Signature block */}
        <div className="mb-10 border-t border-[#1B1B1B]/15 pt-8">
          <h2 className="mb-4 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">Acknowledgement and Signature</h2>
          <p className="mb-6 font-sans text-sm leading-relaxed text-[#1B1B1B]/80">
            I, the undersigned Associate-Licensee, do hereby acknowledge that I have read CnC Realty Group&rsquo;s Independent Contractor Agreement and agree to abide by its provisions during my association with CnC Realty Group.
          </p>
          <div className="space-y-5 font-sans text-sm text-[#1B1B1B]/80">
            {[
              "Associate-Licensee Print Name",
              "Associate-Licensee DRE License #",
              "Associate-Licensee Signature / Date",
              "CnC Realty Group Broker Print Name",
              "CnC Realty Group Broker Signature / Date",
            ].map((label) => (
              <div key={label}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/50">{label}</p>
                <div className="h-px w-72 bg-[#1B1B1B]/20" />
              </div>
            ))}
          </div>
        </div>

        {/* Fee schedule summary */}
        <div className="border-t border-[#1B1B1B]/15 pt-8">
          <h2 className="mb-2 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">Fee Schedule Summary</h2>
          <p className="mb-4 font-sans text-xs text-[#1B1B1B]/50">(Incorporated by reference)</p>
          <SummaryTable />
          <p className="mt-3 font-sans text-xs text-[#1B1B1B]/50">
            CnC Realty Group reserves the right to update the Fee Schedule. The fee schedule in effect at the time a transaction is initiated applies to that transaction. Associate-Licensee will be notified of any fee changes via the CnC Realty Group platform.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-[#1B1B1B]/15 pt-6 font-sans text-xs text-[#1B1B1B]/40">
          CnC Realty Group &middot; cncrealtygroup.com &middot; noreply@cncrealtygroup.com
        </div>

      </div>
    </main>
  );
}
