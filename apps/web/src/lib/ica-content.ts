
// apps/web/src/lib/ica-content.ts

export type IcaParagraph =
  | { type: "p"; text: string }
  | { type: "p-bold"; text: string }
  | { type: "sub"; id: string; boldLead?: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type IcaSection = {
  num: string;
  title: string;
  content: IcaParagraph[];
};

/** Bump this (YYYY-MM-DD) any time the sections/tables below change. */
export const ICA_VERSION = "2026-07-06";

export const ICA_INTRO =
  "This Independent Contractor Agreement (“Agreement”) is made between CnC Realty (DRE License No. 02439028) (“Broker”), and Associate-Licensee. In consideration of the covenants and representations contained in this Agreement, Broker and Associate-Licensee agree as follows:";

const FEE_TABLE: IcaParagraph = {
  type: "table",
  headers: ["Sale / Lease Price", "E&O Supplement", "Total Broker Fee"],
  rows: [
    ["$0 – $1,000,000", "$0", "$990"],
    ["$1,000,001 – $1,500,000", "$200", "$1,190"],
    ["$1,500,001 – $2,000,000", "$400", "$1,390"],
    ["$2,000,001 – $2,500,000", "$600", "$1,590"],
    ["$2,500,001 – $3,000,000", "$800", "$1,790"],
    ["$3,000,001 – $3,500,000", "$1,000", "$1,990"],
    ["$3,500,001 – $4,000,000", "$1,200", "$2,190"],
    ["$4,000,001+", "+$200 per additional $500k", "$2,190 + supplement"],
  ],
};

export const ICA_SECTIONS: IcaSection[] = [
  {
    num: "1", title: "Broker",
    content: [
      { type: "p", text: "Broker is duly licensed in the State of California as a real estate broker. Broker represents that Broker shall keep all licenses current during the term of this Agreement." },
    ],
  },
  {
    num: "2", title: "Associate-Licensee",
    content: [
      { type: "sub", id: "2.1", text: "Associate-Licensee represents that he or she is duly licensed by the State of California as a real estate broker or salesperson (DRE License No. ___________). Associate-Licensee shall keep all applicable license(s), continuing education, and provisional license requirements current during the term of this Agreement. Associate-Licensee shall notify Broker immediately of any change to, suspension of, or revocation of their license." },
      { type: "sub", id: "2.2", text: "Associate-Licensee certifies under penalty of perjury that, as of the date of this Agreement, Associate-Licensee is not under investigation or prosecution by the DRE, the State of California, any Realtor Association, MLS service, or any other government entity for acts including but not limited to complaints, ethics violations, fraud, misconduct, or misrepresentation, and that all information provided to Broker in connection with Associate-Licensee’s application and this Agreement is true and correct." },
    ],
  },
  {
    num: "3", title: "Broker and Associate-Licensee Relationship",
    content: [
      { type: "sub", id: "3.1", text: "Broker and Associate-Licensee are independent contracting parties. This Agreement does not constitute an employment agreement by either party, nor shall it be construed as a partnership. Broker shall not be liable for any obligation, injury, disability, or liability incurred by Associate-Licensee." },
      { type: "sub", id: "3.2", text: "Associate-Licensee agrees to follow the terms outlined in this Agreement, as well as CnC Realty’s Office Policy Manual and Agent Resource materials published on the CnC Realty platform." },
      { type: "sub", id: "3.3", text: "Associate-Licensee may solicit and obtain listings and sales of real estate for the mutual benefit of both parties. Associate-Licensee agrees to comply with all applicable laws, DRE regulations, and the ethical and professional standards of the California Association of REALTORS® and the National Association of REALTORS®. Associate-Licensee agrees to refrain from any act for which the Real Estate Commissioner of the State of California is authorized to suspend or revoke a real estate license." },
      { type: "sub", id: "3.4", text: "Broker shall not limit Associate-Licensee’s activities to geographical areas or the manner in which services are performed, except to the extent required by applicable laws, regulations, agreements, and procedures." },
      { type: "sub", id: "3.5", text: "All lawful actions taken pursuant to this Agreement shall be taken in the name of Broker. Associate-Licensee agrees to contribute all rights and title to any listings to Broker for the benefit and use of Broker, Associate-Licensee, and other licensees of Broker. Associate-Licensee must provide Broker with a complete transaction file for each closing, including all required documentation per Broker’s published checklists." },
      { type: "sub", id: "3.6", text: "Associate-Licensee shall have no authority to bind Broker by any promises or representations, and Broker shall not be liable for any obligation or liability incurred by Associate-Licensee unless Broker has specifically authorized the same in writing." },
    ],
  },
  {
    num: "4", title: "Independent Contractor Status / Tax",
    content: [
      { type: "sub", id: "4.1", text: "Associate-Licensee is an independent contractor for all purposes, including state and federal tax purposes. Broker will NOT withhold income taxes or Social Security from Associate-Licensee’s compensation. Associate-Licensee is solely responsible for payment of all taxes and Social Security contributions. Associate-Licensee will receive an IRS Form 1099-NEC at the end of each calendar year in which Broker paid commissions on Associate-Licensee’s behalf." },
      { type: "sub", id: "4.2", text: "Associate-Licensee is not entitled to unemployment insurance as a result of this Agreement. Broker will provide workers’ compensation insurance for Broker’s own benefit; this fact shall not create an inference of employment." },
    ],
  },
  {
    num: "5", title: "Business Expenses",
    content: [
      { type: "p", text: "Broker shall not be liable to Associate-Licensee for any expenses incurred in the performance of this Agreement. Associate-Licensee is responsible for all professional licenses, dues, MLS fees, Realtor® association fees, marketing materials, technology subscriptions, and any other costs of doing business. Broker shall not provide office space, supplies, or advertising materials unless otherwise agreed to in writing." },
    ],
  },
  {
    num: "6", title: "Licensed Activity",
    content: [
      { type: "p", text: "Associate-Licensee shall be familiar with and comply with all applicable laws, policies, and procedures, including but not limited to anti-discrimination laws, RESPA, the California Business and Professions Code, and all DRE regulations. Associate-Licensee agrees to indemnify Broker against any commissions that may be subject to refund, rebate, or reimbursement by court order or arbitration panel." },
      { type: "p-bold", text: "Written approval from Broker is required before Associate-Licensee may conduct any of the following:" },
      { type: "list", items: [
        "Sale of Associate-Licensee’s personal or family-owned property where Associate-Licensee also acts as agent",
        "Dual agency transactions",
        "Short sale negotiations where Associate-Licensee is not the listing agent and fees for negotiation are being charged",
      ] },
      { type: "p-bold", text: "The following activities are prohibited:" },
      { type: "list", items: [
        "Property management (unless Associate-Licensee is listed on title or has separate written approval)",
        "Loan modifications",
        "Reverse mortgages",
        "Accepting advance fees from clients of any kind",
      ] },
    ],
  },
  {
    num: "7", title: "Compensation / Broker Fees",
    content: [
      { type: "sub", id: "7.1", boldLead: "Compensation Structure.", text: "Compensation shall be charged to the parties who enter into listing or buyer agreements for services requiring a real estate license. Associate-Licensee may use its own discretion regarding the commission fee to charge its clients, subject to the minimum fee described below. Broker’s fee shall be deducted at closing before disbursement to Associate-Licensee." },
      { type: "sub", id: "7.2", boldLead: "Flat Transaction Fee.", text: "Broker’s flat fee per closed transaction is $990, inclusive of Errors & Omissions (E&O) insurance coverage as described in Section 9 for sale or lease values up to and including $1,000,000. For transactions exceeding $1,000,000, an E&O Supplement is added to the base fee." },
      { type: "p-bold", text: "E&O Supplement: $200 per $500,000 (or fraction thereof) of sale or lease price over $1,000,000." },
      FEE_TABLE,
      { type: "p", text: "No monthly fee is charged." },
      { type: "sub", id: "7.3", boldLead: "Associate-Licensee Commission.", text: "After deduction of the flat transaction fee, 100% of the remaining commission is disbursed to Associate-Licensee. Associate-Licensee may receive commission directly from escrow, provided that: (a) the completed transaction file was submitted for Broker’s review no later than two (2) business days before close of escrow, and (b) Broker has certified the file as complete. Unauthorized release of a commission check is grounds for immediate termination." },
      { type: "sub", id: "7.4", boldLead: "Dual Agency and Agent-Relative Sales.", text: "Any transaction in which Associate-Licensee represents both buyer and seller (or both landlord and tenant) is counted as two (2) separate transactions for fee purposes. The full transaction fee — including the base flat fee and any applicable E&O Supplement — shall be charged twice: once for the buyer-side representation and once for the seller-side representation. The same double-fee structure applies to transactions involving the sale or purchase of property owned by or for the benefit of Associate-Licensee, Associate-Licensee’s immediate family member, or any entity in which Associate-Licensee holds an ownership interest, where Associate-Licensee also acts as the representing agent. Written approval from Broker is required for all such transactions per Section 6." },
      { type: "sub", id: "7.5", boldLead: "Referral and Lease Transactions.", text: "The flat transaction fee applies to referrals, leases, and any other transaction for which a real estate license is required. Broker’s fee on referral or lease transactions is the flat fee applicable to the transaction value, or $950 minimum, whichever applies." },
      { type: "sub", id: "7.6", boldLead: "Minimum Fee.", text: "If a transaction closes at a commission amount less than the applicable flat fee, Associate-Licensee is responsible for remitting the balance of Broker’s fee to Broker at closing." },
      { type: "sub", id: "7.7", boldLead: "Commission Advances.", text: "Broker does not offer commission advances. All commissions are paid after close of escrow and file certification." },
      { type: "sub", id: "7.8", boldLead: "Deductions.", text: "Broker may deduct from Associate-Licensee’s commission any actual and pending reasonable expenses arising from Associate-Licensee’s activity, including but not limited to: legal expenses, MLS/board dues paid on Associate-Licensee’s behalf, repayment of any advance, and judgments or settlements. This paragraph applies regardless of whether Associate-Licensee is at fault and whether the matter has been adjudicated." },
      { type: "sub", id: "7.9", boldLead: "Broker-Provided Leads.", text: "For any transaction that closes as a direct result of a lead provided by Broker, Associate-Licensee shall remit to Broker a referral fee equal to twenty-five percent (25%) of Associate-Licensee’s gross commission on that transaction, in addition to the applicable flat transaction fee. The referral fee shall be deducted from Associate-Licensee’s commission at closing. Broker will identify leads as “Broker-provided” in writing at the time of referral." },
      { type: "sub", id: "7.10", boldLead: "Post-Termination Compensation.", text: "Upon termination of this Agreement, payments shall cease; provided that Associate-Licensee shall be entitled to commissions for transactions closed prior to the termination date for which Associate-Licensee has not yet been paid, so long as Associate-Licensee is not in default of this Agreement. Broker may deduct all financial obligations owed to Broker from any commissions due at termination. If pending transactions require further work normally rendered by Associate-Licensee, Broker may assign another licensee to complete the work, and reasonable compensation to the completing licensee shall be deducted from the terminating Associate-Licensee’s commission share." },
    ],
  },
  {
    num: "8", title: "Optional CnC TC Service",
    content: [
      { type: "sub", id: "8.1", text: "CnC Realty offers an optional Transaction Coordinator (“TC”) service for an additional fee of $350 per transaction, payable by the client through escrow at closing. This service is strongly recommended and includes document collection, deadline tracking, and compliance review by a licensed CnC TC coordinator." },
      { type: "sub", id: "8.2", text: "Use of the CnC TC Service is voluntary. Associate-Licensee may use any licensed TC of their choosing, or may self-coordinate, provided all required documentation is submitted to Broker’s platform within required timelines." },
      { type: "sub", id: "8.3", text: "Broker reserves the right to require use of the CnC TC Service for any transaction in which Associate-Licensee has demonstrated a pattern of non-compliance with file submission deadlines or document requirements. In such cases, the $350 fee will be charged to the transaction regardless of client consent." },
      { type: "sub", id: "8.4", text: "The CnC TC Service fee is separate from and in addition to the flat transaction fee described in Section 7.2." },
    ],
  },
  {
    num: "9", title: "Errors & Omissions Insurance",
    content: [
      { type: "sub", id: "9.1", text: "Broker maintains an Errors & Omissions (E&O) insurance policy covering real estate transactions brokered through CnC Realty. Coverage limits are $1,000,000 per claim and $1,000,000 aggregate. The flat transaction fee described in Section 7.2 includes E&O coverage for transactions with a sale or lease value up to and including $1,000,000. For transactions exceeding $1,000,000, the E&O Supplement described in Section 7.2 covers the additional E&O exposure — no further E&O fee is charged beyond what is specified in the fee schedule." },
      { type: "sub", id: "9.2", text: "Associate-Licensee is responsible for any deductible that may be assessed against a claim arising from Associate-Licensee’s transaction(s). Broker’s E&O policy does not cover: personal property transactions by Associate-Licensee (where Associate-Licensee is buying or selling their own property), prohibited activities listed in Section 6, or conduct found by a court or arbitration panel to constitute intentional fraud, misrepresentation, or gross negligence." },
      { type: "sub", id: "9.3", text: "Associate-Licensee must receive written approval from Broker before filing any E&O claim. Unauthorized claims will result in Associate-Licensee being solely responsible for the deductible." },
    ],
  },
  {
    num: "10", title: "Transaction Management & Activity Reporting",
    content: [
      { type: "sub", id: "10.1", text: "Associate-Licensee shall report all real estate activities to Broker within 48 hours of occurrence. Real estate activities include: listing agreements, newly opened escrows, accepted purchase agreements, cancelled or expired agreements, referral fee agreements, and any other business contract involving Associate-Licensee and a client." },
      { type: "sub", id: "10.2", text: "Proper reporting requires Associate-Licensee to open a new transaction record in CnC Realty’s transaction management platform and upload all required documents per Broker’s checklist. For dual agency transactions, Associate-Licensee must create two (2) separate transaction records — one for the listing/seller side and one for the buyer side." },
      { type: "sub", id: "10.3", text: "Commission will not be released until Associate-Licensee has created a complete transaction record in the CnC platform and Broker has certified the file as complete. Closing a transaction without an open and certified transaction record is grounds for withholding of commission until the deficiency is corrected." },
    ],
  },
  {
    num: "11", title: "Documents and Files",
    content: [
      { type: "p", text: "All files and documents pertaining to listings, leads, and transactions are the property of Broker and shall be delivered to Broker in the manner and within the timeframe specified in Broker’s Office Policy Manual. Associate-Licensee is responsible for ensuring that all required documentation, agent credits, and signatures are completed prior to recording. No corrective actions will be permitted after recording." },
    ],
  },
  {
    num: "12", title: "Trust Fund (Earnest Money) Handling",
    content: [
      { type: "p", text: "In accordance with the California Business and Professions Code and Commissioner’s Regulations, trust funds received by Associate-Licensee must be placed into a neutral escrow depository (escrow or title company) or a trust account maintained by Broker, no later than three (3) business days after receipt. Associate-Licensee shall not accept earnest money deposits in Associate-Licensee’s personal or business name, and shall not accept cash payments from clients. Associate-Licensee agrees to follow Broker’s instructions regarding earnest money handling as published on the CnC Realty platform." },
    ],
  },
  {
    num: "13", title: "Fictitious Business Names and Logos",
    content: [
      { type: "p", text: "While affiliated with Broker, Associate-Licensee shall use Broker’s name and corresponding logo on signage, stationery, websites, and any other marketing materials, unless Associate-Licensee has a separate written DBA agreement with Broker filed with the California DRE. Associate-Licensee agrees to discontinue use of Broker’s trademark, logo, and graphics immediately upon termination of this Agreement." },
    ],
  },
  {
    num: "14", title: "Advertising and Solicitations",
    content: [
      { type: "p", text: "All advertising done by Associate-Licensee on behalf of Broker must receive prior written approval from Broker. No telephone solicitation is permitted to persons registered on a national or state do-not-call registry. Broker is not liable for advertising done by Associate-Licensee, and Associate-Licensee agrees to indemnify and hold Broker harmless for any costs or damages arising from Associate-Licensee’s failure to comply with applicable advertising laws." },
    ],
  },
  {
    num: "15", title: "Liability / Indemnity / Fraud and Misrepresentation",
    content: [
      { type: "sub", id: "15.1", text: "Associate-Licensee shall indemnify and hold Broker and its owner(s), affiliates, directors, officers, agents, employees, successors, and assigns harmless from any and all losses, damages, demands, claims, liabilities, costs, and expenses (including reasonable attorney fees) incurred by reason of or arising out of any fraud, misrepresentation, or negligence by Associate-Licensee, including misrepresentation of Associate-Licensee’s relationship with Broker to any third party." },
      { type: "sub", id: "15.2", text: "Associate-Licensee agrees to pay, reimburse, or otherwise be liable to Broker for any reasonable legal expenses, court fees, damages, and representation costs resulting from Associate-Licensee’s real estate transactions or affiliation with Broker, regardless of whether such transactions produced commissions." },
      { type: "sub", id: "15.3", text: "Associate-Licensee agrees to cooperate fully with Broker in the defense of any claim or controversy arising from Associate-Licensee’s transactions or affiliation, including providing testimony, documents, and any other reasonable assistance requested by Broker or Broker’s counsel." },
      { type: "sub", id: "15.4", text: "In the event legal action is necessary to enforce payment, liability, or indemnity terms of this Agreement, Associate-Licensee agrees Broker shall be entitled to collect any judgment or settlement due, plus reasonable attorney fees, court costs, and other enforcement expenses." },
    ],
  },
  {
    num: "16", title: "Injuries to Associate-Licensee",
    content: [
      { type: "p", text: "Associate-Licensee acknowledges that Broker does not provide workers’ compensation insurance for Associate-Licensee’s benefit as Associate-Licensee is an independent contractor. Associate-Licensee is responsible for obtaining appropriate insurance coverage for Associate-Licensee and Associate-Licensee’s employees, if any. Associate-Licensee and Associate-Licensee’s employees waive any rights to recovery from Broker for injuries sustained while performing services under this Agreement." },
    ],
  },
  {
    num: "17", title: "Automobile Insurance",
    content: [
      { type: "p", text: "Associate-Licensee shall maintain automobile insurance coverage for liability and property damage in the minimum amounts required by California law. Associate-Licensee agrees to indemnify Broker against any claims or demands resulting from any automobile accident involving Associate-Licensee." },
    ],
  },
  {
    num: "18", title: "Security and Cyber Fraud",
    content: [
      { type: "p", text: "Associate-Licensee is responsible for the security of their personal computer and digital accounts. Associate-Licensee shall not allow any attorney, title company, or escrow company to send wiring instructions to Associate-Licensee for forwarding to clients. All wiring instructions must be sent directly to clients from the title or escrow company. If Associate-Licensee suspects a fraudulent or cyber-security incident involving a client transaction, Associate-Licensee shall notify Broker within 24 hours." },
    ],
  },
  {
    num: "19", title: "Working Place",
    content: [
      { type: "p", text: "Broker does not provide office space for Associate-Licensee. Associate-Licensee may work from home, personal office, or any other location of Associate-Licensee’s choice. Associate-Licensee must store all transaction documents securely and be able to present them to Broker within 24 hours of request. Associate-Licensee must be accessible by phone and email and maintain current contact information in the CnC Realty platform." },
    ],
  },
  {
    num: "20", title: "Confidential Information and Non-Disclosure",
    content: [
      { type: "p", text: "Associate-Licensee will have access to confidential information owned by Broker, including client data, proprietary systems, and business processes. Associate-Licensee shall keep all confidential information strictly confidential during the term of this Agreement and after termination, and shall not use such information for any purpose other than performance of this Agreement." },
    ],
  },
  {
    num: "21", title: "Termination of Agreement",
    content: [
      { type: "p", text: "This Agreement may be terminated by either party, at any time, with or without cause, upon written notice. Even after termination, this Agreement shall govern all disputes and claims between Broker and Associate-Licensee connected with their relationship under this Agreement. Upon termination, Associate-Licensee shall immediately cease use of Broker’s name, logo, and trademarks." },
    ],
  },
  {
    num: "22", title: "Dispute Resolution",
    content: [
      { type: "p", text: "The parties agree to attempt mediation before initiating arbitration or litigation. Any disputes or claims between Broker and Associate-Licensee that cannot be resolved by negotiation shall be submitted to binding arbitration pursuant to the rules of the California Association of REALTORS® or the American Arbitration Association. This Agreement is governed by the laws of the State of California. Jurisdiction and venue shall be in the County of Los Angeles, California." },
    ],
  },
  {
    num: "23", title: "Associate-Licensee's Employees",
    content: [
      { type: "p", text: "Associate-Licensee may employ personal assistants provided that: (a) there is a written agreement between Associate-Licensee and the personal assistant outlining all terms, compensation, supervision, and compliance responsibilities; and (b) if the personal assistant holds a California real estate license, a copy of that license is provided to Broker. Associate-Licensee is responsible for supervising personal assistants and ensuring their compliance with all terms of this Agreement." },
    ],
  },
  {
    num: "24", title: "Mentorship Program",
    content: [
      { type: "sub", id: "24.1", text: "CnC Realty offers an optional Mentorship Program for Associate-Licensees with little or no transactional experience. Participation in the Mentorship Program requires a separate written Mentorship Agreement signed by the Associate-Licensee, the assigned Mentor, and Broker." },
      { type: "sub", id: "24.2", text: "Under the Mentorship Program, the commission split is 70% to Associate-Licensee and 30% to the assigned Mentor. The flat transaction fee (Section 7.2) and the CnC TC Service fee (Section 8, if applicable) are deducted from the gross commission before the 70/30 split is applied." },
      { type: "sub", id: "24.3", text: "The 70/30 mentorship split applies to both sides of any dual agency transaction. If Associate-Licensee represents both buyer and seller while enrolled in the Mentorship Program, the mentorship split applies to each side separately." },
      { type: "sub", id: "24.4", text: "Upon successful completion of the Associate-Licensee’s first closed transaction under the Mentorship Program, the Associate-Licensee will transition to 100% commission (less the applicable flat transaction fee) for all subsequent transactions, unless otherwise agreed in writing." },
    ],
  },
  {
    num: "25", title: "Entire Agreement",
    content: [
      { type: "p", text: "This Agreement, together with CnC Realty’s Office Policy Manual (incorporated herein by reference), constitutes the entire agreement of the parties regarding Associate-Licensee’s affiliation with Broker. There are no other promises or conditions not set forth in writing herein. This Agreement supersedes all prior written or verbal agreements between the parties. This Agreement may be modified only by a written amendment signed by both parties. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall remain valid and enforceable." },
    ],
  },
  {
    num: "26", title: "Associate-Licensee Agrees and Understands That",
    content: [
      { type: "list", items: [
        "CnC Realty’s Office Policy Manual contains important policies. Associate-Licensee is advised to read, understand, and follow all policies. Broker may update policies with or without prior notice.",
        "Associate-Licensee agrees to all fees and charges set forth in this Agreement. The fee schedule in effect at the time a transaction is initiated applies to that transaction.",
        "Associate-Licensee’s electronic or written signature below confirms that Associate-Licensee has read this Agreement and agrees to abide by its provisions.",
      ] },
    ],
  },
];

export const SIGNATURE_LABELS = [
  "Associate-Licensee Print Name",
  "Associate-Licensee DRE License #",
  "Associate-Licensee Signature / Date",
  "CnC Realty Broker Print Name",
  "CnC Realty Broker Signature / Date",
];

export const SUMMARY_TABLE = {
  headers: ["Item", "Amount"],
  rows: [
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
  ],
};

