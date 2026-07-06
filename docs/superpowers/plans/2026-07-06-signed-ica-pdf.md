# Signed ICA PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a typed-name electronic signature on the CnC Realty agent application, generate a signed PDF snapshot of the ICA at submission time, store it in Cloudflare R2, and let an admin download it from the agent's row in `/admin/agents`.

**Architecture:** Consolidate the ICA text (currently duplicated as hardcoded JSX in `/join/ica/page.tsx` and in `docs/cnc-ica-draft.md`) into one canonical TypeScript content module. A new `pdf-lib`-based generator renders that same content module into a PDF with a signature block, at the moment the applicant submits. The PDF is uploaded to the existing R2 bucket and its key is carried from `AgentApplication` → `Agent` on approval. A small admin-only API route returns a fresh presigned URL for download.

**Tech Stack:** Next.js 14 App Router API routes, Prisma/PostgreSQL, `pdf-lib` (new dependency), existing `@aws-sdk/client-s3`-backed `lib/r2.ts`, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-signed-ica-pdf-design.md` — follow it exactly; this plan implements it.
- Signature name must match `firstName` + `lastName` from the same submission (case/whitespace-insensitive), validated both client- and server-side.
- PDF generation happens once, at application-submission time — never regenerated later.
- No backfill for agents approved before this feature exists — their admin row simply shows no download link (rendered as `—`, matching the existing empty-cell convention in that table).
- `docs/cnc-ica-draft.md` stays a manual reference copy for attorney review — do not attempt to auto-sync it from the new content module (out of scope per spec).
- Run all tests with `pnpm --filter web test` from `C:\Users\hey_r\Desktop\CnC-Realty`.
- This is a Windows machine — if `prisma generate`/`prisma migrate dev` fails with an `EPERM` error on `query_engine-windows.dll.node`, stop all node processes first (`Stop-Process -Name "node" -Force` in PowerShell) then retry, per the established project workflow.

---

### Task 1: Add `pdf-lib` dependency

**Files:**
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `pdf-lib` package (`PDFDocument`, `StandardFonts`, `rgb`) available to import in `apps/web/src`.

- [ ] **Step 1: Install the dependency**

Run: `pnpm --filter web add pdf-lib`

- [ ] **Step 2: Verify it's importable**

Run: `pnpm --filter web exec node -e "require('pdf-lib'); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add pdf-lib dependency"
```

---

### Task 2: Canonical ICA content module

**Files:**
- Create: `apps/web/src/lib/ica-content.ts`
- Test: `apps/web/src/__tests__/lib/ica-content.test.ts`

**Interfaces:**
- Produces:
  - `type IcaParagraph = { type: "p"; text: string } | { type: "p-bold"; text: string } | { type: "sub"; id: string; boldLead?: string; text: string } | { type: "list"; items: string[] } | { type: "table"; headers: string[]; rows: string[][] }`
  - `type IcaSection = { num: string; title: string; content: IcaParagraph[] }`
  - `ICA_VERSION: string`
  - `ICA_INTRO: string`
  - `ICA_SECTIONS: IcaSection[]` (26 sections)
  - `SIGNATURE_LABELS: string[]` (5 labels)
  - `SUMMARY_TABLE: { headers: string[]; rows: string[][] }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/lib/ica-content.test.ts
import { describe, it, expect } from "vitest";
import { ICA_VERSION, ICA_INTRO, ICA_SECTIONS, SIGNATURE_LABELS, SUMMARY_TABLE } from "@/lib/ica-content";

describe("ica-content", () => {
  it("has a version string in YYYY-MM-DD format", () => {
    expect(ICA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has a non-empty intro paragraph", () => {
    expect(ICA_INTRO.length).toBeGreaterThan(20);
  });

  it("has exactly 26 numbered sections in order 1..26", () => {
    expect(ICA_SECTIONS).toHaveLength(26);
    ICA_SECTIONS.forEach((s, i) => expect(s.num).toBe(String(i + 1)));
  });

  it("every section has at least one content item", () => {
    ICA_SECTIONS.forEach((s) => expect(s.content.length).toBeGreaterThan(0));
  });

  it("section 7 contains the fee table with 8 rows", () => {
    const section7 = ICA_SECTIONS.find((s) => s.num === "7")!;
    const table = section7.content.find((c) => c.type === "table");
    expect(table).toBeDefined();
    expect((table as { rows: string[][] }).rows).toHaveLength(8);
  });

  it("has 5 signature labels", () => {
    expect(SIGNATURE_LABELS).toHaveLength(5);
  });

  it("has a 2-column summary table with 10 rows", () => {
    expect(SUMMARY_TABLE.headers).toHaveLength(2);
    expect(SUMMARY_TABLE.rows).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-content.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ica-content'"

- [ ] **Step 3: Write the content module**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-content.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ica-content.ts apps/web/src/__tests__/lib/ica-content.test.ts
git commit -m "feat: canonical ICA content module (single source of truth)"
```

---

### Task 3: Refactor `/join/ica` page to render from the content module

**Files:**
- Modify: `apps/web/src/app/(marketing)/join/ica/page.tsx` (replace entirely)

**Interfaces:**
- Consumes: `ICA_INTRO`, `ICA_SECTIONS`, `SIGNATURE_LABELS`, `SUMMARY_TABLE`, `IcaParagraph`, `IcaSection` from `@/lib/ica-content` (Task 2)

This is a pure refactor — visual output must stay identical to what's live today (same headings, spacing, bold labels, bullet lists, and both tables). No test framework in this repo covers page-level rendering (no React Testing Library is installed — confirmed by grep, this project only tests API routes and lib functions), so verification here is a TypeScript build check plus a manual visual diff, consistent with how every other visual page in this codebase has been verified throughout the project.

- [ ] **Step 1: Replace the page file**

```tsx
// apps/web/src/app/(marketing)/join/ica/page.tsx
import type { Metadata } from "next";
import { ICA_INTRO, ICA_SECTIONS, SIGNATURE_LABELS, SUMMARY_TABLE, type IcaParagraph } from "@/lib/ica-content";

export const metadata: Metadata = {
  title: "Independent Contractor Agreement | CnC Realty",
  description: "CnC Realty Independent Contractor Agreement for licensed real estate agents.",
};

function FeeTableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/15 bg-[#1B1B1B]/5">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-2 text-left font-semibold text-[#1B1B1B] ${i < headers.length - 1 ? "pr-4" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1B1B1B]/10">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 text-[#1B1B1B]/80 ${j < row.length - 1 ? "pr-4" : ""} ${
                    j === row.length - 1 ? "font-semibold text-[#1B1B1B]" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParagraphItem({ item }: { item: IcaParagraph }) {
  if (item.type === "p") return <p>{item.text}</p>;
  if (item.type === "p-bold") return <p className="font-semibold text-[#1B1B1B]">{item.text}</p>;
  if (item.type === "sub") {
    return (
      <p>
        <span className="font-semibold text-[#1B1B1B]">{item.id}.</span>{" "}
        {item.boldLead && <strong className="text-[#1B1B1B]">{item.boldLead} </strong>}
        {item.text}
      </p>
    );
  }
  if (item.type === "list") {
    return (
      <ul className="ml-4 list-disc space-y-1 text-[#1B1B1B]/80">
        {item.items.map((li, i) => (
          <li key={i}>{li}</li>
        ))}
      </ul>
    );
  }
  return <FeeTableBlock headers={item.headers} rows={item.rows} />;
}

export default function IcaPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 rounded-lg border border-[#9E8C61]/40 bg-[#9E8C61]/8 px-4 py-3 font-sans text-xs text-[#9E8C61]">
          DRAFT — Pending attorney review. This document is provided for informational purposes only and does not constitute legal advice.
        </div>

        <div className="mb-10 border-b border-[#1B1B1B]/15 pb-8">
          <p className="mb-1 text-center font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">CnC Realty</p>
          <h1 className="text-center font-sans text-3xl font-medium text-[#1B1B1B]">Independent Contractor Agreement</h1>
          <p className="mt-14 font-sans text-sm leading-relaxed text-[#1B1B1B]/60">{ICA_INTRO}</p>
        </div>

        {ICA_SECTIONS.map((section) => (
          <section key={section.num} className="mb-8">
            <h2 className="mb-3 font-sans text-xl font-semibold uppercase tracking-wide text-[#1B1B1B]">
              {section.num}. {section.title}
            </h2>
            <div className="space-y-3 font-sans text-base leading-relaxed text-[#1B1B1B]/80">
              {section.content.map((item, i) => (
                <ParagraphItem key={i} item={item} />
              ))}
            </div>
          </section>
        ))}

        <div className="mb-10 border-t border-[#1B1B1B]/15 pt-8">
          <h2 className="mb-4 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">Acknowledgement and Signature</h2>
          <p className="mb-6 font-sans text-sm leading-relaxed text-[#1B1B1B]/80">
            I, the undersigned Associate-Licensee, do hereby acknowledge that I have read CnC Realty&rsquo;s Independent Contractor Agreement and agree to abide by its provisions during my association with CnC Realty.
          </p>
          <div className="space-y-5 font-sans text-sm text-[#1B1B1B]/80">
            {SIGNATURE_LABELS.map((label) => (
              <div key={label}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/50">{label}</p>
                <div className="h-px w-72 bg-[#1B1B1B]/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#1B1B1B]/15 pt-8">
          <h2 className="mb-2 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">Fee Schedule Summary</h2>
          <p className="mb-4 font-sans text-xs text-[#1B1B1B]/50">(Incorporated by reference)</p>
          <FeeTableBlock headers={SUMMARY_TABLE.headers} rows={SUMMARY_TABLE.rows} />
          <p className="mt-3 font-sans text-xs text-[#1B1B1B]/50">
            CnC Realty reserves the right to update the Fee Schedule. The fee schedule in effect at the time a transaction is initiated applies to that transaction. Associate-Licensee will be notified of any fee changes via the CnC Realty platform.
          </p>
        </div>

        <div className="mt-10 border-t border-[#1B1B1B]/15 pt-6 font-sans text-xs text-[#1B1B1B]/40">
          CnC Realty &middot; cncrealtygroup.com &middot; noreply@cncrealtygroup.com
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors referencing `join/ica/page.tsx` or `lib/ica-content.ts`

- [ ] **Step 3: Manual visual check**

Run: `pnpm --filter web dev`, open `http://localhost:3000/join/ica`, compare against the previous version (git stash the change temporarily if a side-by-side is needed) — confirm all 26 sections, the fee table, signature block, and fee schedule summary render identically.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(marketing)/join/ica/page.tsx"
git commit -m "refactor: render /join/ica from the canonical content module"
```

---

### Task 3B: Fix Task 3 review findings — inline bold, list spacing, table weight

**Files:**
- Modify: `apps/web/src/lib/ica-content.ts` (already committed in Task 2)
- Modify: `apps/web/src/__tests__/lib/ica-content.test.ts` (already committed in Task 2)
- Modify: `apps/web/src/app/(marketing)/join/ica/page.tsx` (already committed in Task 3)

**Interfaces:**
- Produces: `RichText` type and `richTextToPlain()` helper exported from `@/lib/ica-content` — consumed by Task 5's PDF generator (already amended above to expect this).

**Why:** The Task 3 task-reviewer found that the original hardcoded JSX had `<strong>` bold spans *inside* several sentences (e.g. "$990" mid-sentence in Section 7.2, a whole bolded sentence in 10.2), which the Task 2 data model couldn't represent (it only supported one bold *label* at the very start of a sub-item, via `boldLead`). It also found two smaller regressions: Section 26's bullet list lost its extra spacing, and the Fee Schedule Summary table's "Amount" column became bold when the original was a lighter weight. Ryan reviewed this and asked to fix all three properly rather than skip them.

- [ ] **Step 1: Add the `RichText` type and helper to `ica-content.ts`**

Add near the top of `apps/web/src/lib/ica-content.ts`, right before the `IcaParagraph` type:

```ts
/** A run of text that's either plain or bold — lets a sentence mix both. */
export type TextRun = string | { bold: string };
/** Most paragraphs are a plain string; a few need inline bold spans mid-sentence. */
export type RichText = string | TextRun[];

export function richTextToPlain(text: RichText): string {
  if (typeof text === "string") return text;
  return text.map((run) => (typeof run === "string" ? run : run.bold)).join("");
}
```

- [ ] **Step 2: Widen `IcaParagraph`'s `text` fields to `RichText`, add list spacing**

Change the `IcaParagraph` type definition:

```ts
export type IcaParagraph =
  | { type: "p"; text: RichText }
  | { type: "p-bold"; text: string }
  | { type: "sub"; id: string; boldLead?: string; text: RichText }
  | { type: "list"; items: string[]; spacing?: "tight" | "loose" }
  | { type: "table"; headers: string[]; rows: string[][] };
```

(Every existing entry with `text: "some plain string"` stays valid unchanged, since `RichText` includes `string`. Only the specific entries below need to change shape.)

- [ ] **Step 3: Change `ICA_INTRO` to a `RichText` array**

Replace:

```ts
export const ICA_INTRO =
  "This Independent Contractor Agreement (“Agreement”) is made between CnC Realty (DRE License No. 02439028) (“Broker”), and Associate-Licensee. In consideration of the covenants and representations contained in this Agreement, Broker and Associate-Licensee agree as follows:";
```

With:

```ts
export const ICA_INTRO: RichText = [
  "This Independent Contractor Agreement (“Agreement”) is made between ",
  { bold: "CnC Realty" },
  " (DRE License No. 02439028) (“Broker”), and ",
  { bold: "Associate-Licensee" },
  ". In consideration of the covenants and representations contained in this Agreement, Broker and Associate-Licensee agree as follows:",
];
```

- [ ] **Step 4: Restore inline bold on the 5 affected sub-items**

In the Section 7 entry, replace the `7.2` sub-item:

```ts
      { type: "sub", id: "7.2", boldLead: "Flat Transaction Fee.", text: "Broker’s flat fee per closed transaction is $990, inclusive of Errors & Omissions (E&O) insurance coverage as described in Section 9 for sale or lease values up to and including $1,000,000. For transactions exceeding $1,000,000, an E&O Supplement is added to the base fee." },
```

With:

```ts
      { type: "sub", id: "7.2", boldLead: "Flat Transaction Fee.", text: [
        "Broker’s flat fee per closed transaction is ",
        { bold: "$990" },
        ", inclusive of Errors & Omissions (E&O) insurance coverage as described in Section 9 for sale or lease values up to and including $1,000,000. For transactions exceeding $1,000,000, an E&O Supplement is added to the base fee.",
      ] },
```

In the Section 8 entry, replace the `8.1` sub-item:

```ts
      { type: "sub", id: "8.1", text: "CnC Realty offers an optional Transaction Coordinator (“TC”) service for an additional fee of $350 per transaction, payable by the client through escrow at closing. This service is strongly recommended and includes document collection, deadline tracking, and compliance review by a licensed CnC TC coordinator." },
```

With:

```ts
      { type: "sub", id: "8.1", text: [
        "CnC Realty offers an optional Transaction Coordinator (“TC”) service for an additional fee of ",
        { bold: "$350 per transaction" },
        ", payable by the client through escrow at closing. This service is strongly recommended and includes document collection, deadline tracking, and compliance review by a licensed CnC TC coordinator.",
      ] },
```

In the Section 10 entry, replace the `10.2` sub-item:

```ts
      { type: "sub", id: "10.2", text: "Proper reporting requires Associate-Licensee to open a new transaction record in CnC Realty’s transaction management platform and upload all required documents per Broker’s checklist. For dual agency transactions, Associate-Licensee must create two (2) separate transaction records — one for the listing/seller side and one for the buyer side." },
```

With:

```ts
      { type: "sub", id: "10.2", text: [
        "Proper reporting requires Associate-Licensee to open a new transaction record in CnC Realty’s transaction management platform and upload all required documents per Broker’s checklist. ",
        { bold: "For dual agency transactions, Associate-Licensee must create two (2) separate transaction records — one for the listing/seller side and one for the buyer side." },
      ] },
```

In the Section 24 entry, replace the `24.2` and `24.3` sub-items:

```ts
      { type: "sub", id: "24.2", text: "Under the Mentorship Program, the commission split is 70% to Associate-Licensee and 30% to the assigned Mentor. The flat transaction fee (Section 7.2) and the CnC TC Service fee (Section 8, if applicable) are deducted from the gross commission before the 70/30 split is applied." },
      { type: "sub", id: "24.3", text: "The 70/30 mentorship split applies to both sides of any dual agency transaction. If Associate-Licensee represents both buyer and seller while enrolled in the Mentorship Program, the mentorship split applies to each side separately." },
```

With:

```ts
      { type: "sub", id: "24.2", text: [
        "Under the Mentorship Program, the commission split is ",
        { bold: "70% to Associate-Licensee and 30% to the assigned Mentor" },
        ". The flat transaction fee (Section 7.2) and the CnC TC Service fee (Section 8, if applicable) are deducted from the gross commission ",
        { bold: "before" },
        " the 70/30 split is applied.",
      ] },
      { type: "sub", id: "24.3", text: [
        "The 70/30 mentorship split applies to ",
        { bold: "both sides" },
        " of any dual agency transaction. If Associate-Licensee represents both buyer and seller while enrolled in the Mentorship Program, the mentorship split applies to each side separately.",
      ] },
```

- [ ] **Step 5: Fix Section 26's list spacing**

In the Section 26 entry, replace:

```ts
      { type: "list", items: [
```

With:

```ts
      { type: "list", spacing: "loose", items: [
```

(This is the only `list` entry in `ICA_SECTIONS` that needs `spacing: "loose"` — Section 6's two lists stay as plain `{ type: "list", items: [...] }`, which defaults to tight spacing, matching their original `space-y-1`.)

- [ ] **Step 6: Update the content module test**

In `apps/web/src/__tests__/lib/ica-content.test.ts`, update the import and the intro-paragraph test:

```ts
import { ICA_VERSION, ICA_INTRO, ICA_SECTIONS, SIGNATURE_LABELS, SUMMARY_TABLE, richTextToPlain } from "@/lib/ica-content";
```

```ts
  it("has a non-empty intro paragraph", () => {
    expect(richTextToPlain(ICA_INTRO).length).toBeGreaterThan(20);
  });
```

Add one new test confirming inline bold works:

```ts
  it("supports inline bold spans mid-sentence", () => {
    const section7 = ICA_SECTIONS.find((s) => s.num === "7")!;
    const item72 = section7.content.find((c) => c.type === "sub" && c.id === "7.2") as { text: unknown };
    expect(Array.isArray(item72.text)).toBe(true);
    expect(richTextToPlain(item72.text as Parameters<typeof richTextToPlain>[0])).toContain("$990");
  });
```

- [ ] **Step 7: Run the content module test**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-content.test.ts`
Expected: PASS (8 tests — the original 7 plus the new inline-bold test)

- [ ] **Step 8: Update `page.tsx` to render `RichText` and fix table/list styling**

In `apps/web/src/app/(marketing)/join/ica/page.tsx`, add a `RichTextSpan` component and update `FeeTableBlock` and `ParagraphItem`:

```tsx
import type { Metadata } from "next";
import { ICA_INTRO, ICA_SECTIONS, SIGNATURE_LABELS, SUMMARY_TABLE, type IcaParagraph, type RichText } from "@/lib/ica-content";

export const metadata: Metadata = {
  title: "Independent Contractor Agreement | CnC Realty",
  description: "CnC Realty Independent Contractor Agreement for licensed real estate agents.",
};

function RichTextSpan({ text }: { text: RichText }) {
  if (typeof text === "string") return <>{text}</>;
  return (
    <>
      {text.map((run, i) =>
        typeof run === "string" ? (
          <span key={i}>{run}</span>
        ) : (
          <strong key={i} className="text-[#1B1B1B]">{run.bold}</strong>
        )
      )}
    </>
  );
}

function FeeTableBlock({
  headers,
  rows,
  boldLastColumn = true,
}: {
  headers: string[];
  rows: string[][];
  boldLastColumn?: boolean;
}) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="border-b border-[#1B1B1B]/15 bg-[#1B1B1B]/5">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-2 text-left font-semibold text-[#1B1B1B] ${i < headers.length - 1 ? "pr-4" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1B1B1B]/10">
              {row.map((cell, j) => {
                const isLast = j === row.length - 1;
                return (
                  <td
                    key={j}
                    className={`py-2 text-[#1B1B1B]/80 ${isLast ? "" : "pr-4"} ${
                      isLast ? (boldLastColumn ? "font-semibold text-[#1B1B1B]" : "font-medium text-[#1B1B1B]") : ""
                    }`}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParagraphItem({ item }: { item: IcaParagraph }) {
  if (item.type === "p") return <p><RichTextSpan text={item.text} /></p>;
  if (item.type === "p-bold") return <p className="font-semibold text-[#1B1B1B]">{item.text}</p>;
  if (item.type === "sub") {
    return (
      <p>
        <span className="font-semibold text-[#1B1B1B]">{item.id}.</span>{" "}
        {item.boldLead && <strong className="text-[#1B1B1B]">{item.boldLead} </strong>}
        <RichTextSpan text={item.text} />
      </p>
    );
  }
  if (item.type === "list") {
    return (
      <ul className={`ml-4 list-disc text-[#1B1B1B]/80 ${item.spacing === "loose" ? "space-y-2" : "space-y-1"}`}>
        {item.items.map((li, i) => (
          <li key={i}>{li}</li>
        ))}
      </ul>
    );
  }
  return <FeeTableBlock headers={item.headers} rows={item.rows} />;
}

export default function IcaPage() {
  return (
    <main className="min-h-screen bg-[#F2F0EF]">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 rounded-lg border border-[#9E8C61]/40 bg-[#9E8C61]/8 px-4 py-3 font-sans text-xs text-[#9E8C61]">
          DRAFT — Pending attorney review. This document is provided for informational purposes only and does not constitute legal advice.
        </div>

        <div className="mb-10 border-b border-[#1B1B1B]/15 pb-8">
          <p className="mb-1 text-center font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">CnC Realty</p>
          <h1 className="text-center font-sans text-3xl font-medium text-[#1B1B1B]">Independent Contractor Agreement</h1>
          <p className="mt-14 font-sans text-sm leading-relaxed text-[#1B1B1B]/60"><RichTextSpan text={ICA_INTRO} /></p>
        </div>

        {ICA_SECTIONS.map((section) => (
          <section key={section.num} className="mb-8">
            <h2 className="mb-3 font-sans text-xl font-semibold uppercase tracking-wide text-[#1B1B1B]">
              {section.num}. {section.title}
            </h2>
            <div className="space-y-3 font-sans text-base leading-relaxed text-[#1B1B1B]/80">
              {section.content.map((item, i) => (
                <ParagraphItem key={i} item={item} />
              ))}
            </div>
          </section>
        ))}

        <div className="mb-10 border-t border-[#1B1B1B]/15 pt-8">
          <h2 className="mb-4 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">Acknowledgement and Signature</h2>
          <p className="mb-6 font-sans text-sm leading-relaxed text-[#1B1B1B]/80">
            I, the undersigned Associate-Licensee, do hereby acknowledge that I have read CnC Realty&rsquo;s Independent Contractor Agreement and agree to abide by its provisions during my association with CnC Realty.
          </p>
          <div className="space-y-5 font-sans text-sm text-[#1B1B1B]/80">
            {SIGNATURE_LABELS.map((label) => (
              <div key={label}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#1B1B1B]/50">{label}</p>
                <div className="h-px w-72 bg-[#1B1B1B]/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#1B1B1B]/15 pt-8">
          <h2 className="mb-2 font-sans text-base font-semibold uppercase tracking-wide text-[#1B1B1B]">Fee Schedule Summary</h2>
          <p className="mb-4 font-sans text-xs text-[#1B1B1B]/50">(Incorporated by reference)</p>
          <FeeTableBlock headers={SUMMARY_TABLE.headers} rows={SUMMARY_TABLE.rows} boldLastColumn={false} />
          <p className="mt-3 font-sans text-xs text-[#1B1B1B]/50">
            CnC Realty reserves the right to update the Fee Schedule. The fee schedule in effect at the time a transaction is initiated applies to that transaction. Associate-Licensee will be notified of any fee changes via the CnC Realty platform.
          </p>
        </div>

        <div className="mt-10 border-t border-[#1B1B1B]/15 pt-6 font-sans text-xs text-[#1B1B1B]/40">
          CnC Realty &middot; cncrealtygroup.com &middot; noreply@cncrealtygroup.com
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Verify the build compiles**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors referencing `join/ica/page.tsx` or `lib/ica-content.ts`

- [ ] **Step 10: Run the content module test suite once more**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-content.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/lib/ica-content.ts apps/web/src/__tests__/lib/ica-content.test.ts "apps/web/src/app/(marketing)/join/ica/page.tsx"
git commit -m "fix: restore inline bold, list spacing, and table weight lost in ica-content refactor"
```

---

### Task 4: Shared signature name-match validator

**Files:**
- Create: `apps/web/src/lib/ica-signature.ts`
- Test: `apps/web/src/__tests__/lib/ica-signature.test.ts`

**Interfaces:**
- Produces: `namesMatch(signatureName: string, firstName: string, lastName: string): boolean`
- Consumed by: Task 7 (server-side re-validation) and Task 8 (client-side validation) — both import this same function, no duplicated logic.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/lib/ica-signature.test.ts
import { describe, it, expect } from "vitest";
import { namesMatch } from "@/lib/ica-signature";

describe("namesMatch", () => {
  it("matches an exact name", () => {
    expect(namesMatch("Jane Smith", "Jane", "Smith")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(namesMatch("jane smith", "Jane", "Smith")).toBe(true);
  });

  it("matches with extra/irregular whitespace", () => {
    expect(namesMatch("  Jane   Smith  ", "Jane", "Smith")).toBe(true);
  });

  it("rejects a different name", () => {
    expect(namesMatch("John Smith", "Jane", "Smith")).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(namesMatch("", "Jane", "Smith")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-signature.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ica-signature'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/ica-signature.ts
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function namesMatch(signatureName: string, firstName: string, lastName: string): boolean {
  return normalize(signatureName) === normalize(`${firstName} ${lastName}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-signature.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ica-signature.ts apps/web/src/__tests__/lib/ica-signature.test.ts
git commit -m "feat: shared ICA signature name-match validator"
```

---

### Task 5: PDF generator

**Files:**
- Create: `apps/web/src/lib/ica-pdf.ts`
- Test: `apps/web/src/__tests__/lib/ica-pdf.test.ts`

**Interfaces:**
- Consumes: `ICA_VERSION`, `ICA_INTRO`, `ICA_SECTIONS`, `SUMMARY_TABLE`, `RichText`, `richTextToPlain` from `@/lib/ica-content` (Task 2, amended post-Task-3-review — see the "Task 2/3 Amendment" note after Task 3 above for why `RichText` exists)
- Produces: `generateSignedIcaPdf(input: { signerName: string; signedAt: Date; signerIp: string }): Promise<Buffer>` — consumed by Task 7.

**Note:** `ICA_INTRO` and the `text` field on `"p"`/`"sub"` paragraph items are typed `RichText` (`string | (string | { bold: string })[]`), not plain `string` — a handful of sentences have inline bold spans (e.g. "$990" in Section 7.2) that a plain string can't represent. The PDF must render those bold spans too, so the generator needs a rich-text-aware paragraph drawer (below), not the single-font `drawParagraph` used for section headings and labels.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/lib/ica-pdf.test.ts
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateSignedIcaPdf } from "@/lib/ica-pdf";

describe("generateSignedIcaPdf", () => {
  it("produces a valid multi-page PDF containing the signature block", async () => {
    const buffer = await generateSignedIcaPdf({
      signerName: "Jane Smith",
      signedAt: new Date("2026-07-06T12:00:00.000Z"),
      signerIp: "1.2.3.4",
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    const loaded = await PDFDocument.load(buffer);
    expect(loaded.getPageCount()).toBeGreaterThan(5);
  });
});
```

(This test is unchanged from the original — it doesn't need to know about `RichText` internals, only that the PDF is well-formed.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-pdf.test.ts`
Expected: FAIL with "Cannot find module '@/lib/ica-pdf'"

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/ica-pdf.ts
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { ICA_VERSION, ICA_INTRO, ICA_SECTIONS, SUMMARY_TABLE, type RichText } from "./ica-content";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10;
const LINE_GAP = 4;

interface Writer {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function newPage(w: Writer) {
  w.page = w.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  w.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(w: Writer, needed: number) {
  if (w.y - needed < MARGIN) newPage(w);
}

function drawParagraph(w: Writer, text: string, opts: { bold?: boolean; indent?: number } = {}) {
  const size = BODY_SIZE;
  const font = opts.bold ? w.bold : w.font;
  const indent = opts.indent ?? 0;
  const maxWidth = CONTENT_WIDTH - indent;
  for (const line of wrapText(text, font, size, maxWidth)) {
    ensureSpace(w, size + LINE_GAP);
    w.page.drawText(line, { x: MARGIN + indent, y: w.y - size, size, font });
    w.y -= size + LINE_GAP;
  }
}

/**
 * Splits RichText into a flat token stream, tagging each word with whether it's bold
 * and whether a space should render before it. `spaceBefore` is computed from actual
 * whitespace adjacency in the source text — a bold run directly followed by punctuation
 * with no space (e.g. "$990" then ", inclusive...") must NOT get a phantom space inserted
 * at that run boundary, even though word-splitting elsewhere always implies a space.
 */
export function tokenizeRichText(text: RichText): { word: string; bold: boolean; spaceBefore: boolean }[] {
  const runs = typeof text === "string" ? [text] : text;
  const tokens: { word: string; bold: boolean; spaceBefore: boolean }[] = [];
  let prevRunEndedWithSpace = true;
  for (const run of runs) {
    const isBold = typeof run !== "string";
    const str = typeof run === "string" ? run : run.bold;
    const startsWithSpace = /^\s/.test(str);
    const words = str.split(/\s+/).filter(Boolean);
    words.forEach((word, i) => {
      const spaceBefore = i === 0 ? prevRunEndedWithSpace || startsWithSpace : true;
      tokens.push({ word, bold: isBold, spaceBefore });
    });
    prevRunEndedWithSpace = str.length === 0 || /\s$/.test(str);
  }
  return tokens;
}

/** Word-wraps and draws RichText, switching font per word so inline bold spans render correctly. */
function drawRichParagraph(w: Writer, text: RichText, opts: { indent?: number } = {}) {
  const size = BODY_SIZE;
  const indent = opts.indent ?? 0;
  const maxWidth = CONTENT_WIDTH - indent;
  const tokens = tokenizeRichText(text);
  const spaceWidth = w.font.widthOfTextAtSize(" ", size);

  let line: { word: string; bold: boolean; spaceBefore: boolean }[] = [];
  let lineWidth = 0;

  function flushLine() {
    if (line.length === 0) return;
    ensureSpace(w, size + LINE_GAP);
    let x = MARGIN + indent;
    line.forEach((tok, i) => {
      const font = tok.bold ? w.bold : w.font;
      if (i > 0 && tok.spaceBefore) x += spaceWidth;
      w.page.drawText(tok.word, { x, y: w.y - size, size, font });
      x += font.widthOfTextAtSize(tok.word, size);
    });
    w.y -= size + LINE_GAP;
    line = [];
    lineWidth = 0;
  }

  for (const tok of tokens) {
    const font = tok.bold ? w.bold : w.font;
    const wordWidth = font.widthOfTextAtSize(tok.word, size);
    const sep = line.length > 0 && tok.spaceBefore ? spaceWidth : 0;
    const addedWidth = sep + wordWidth;
    if (lineWidth + addedWidth > maxWidth && line.length > 0) {
      flushLine();
      line = [tok];
      lineWidth = wordWidth;
    } else {
      lineWidth += addedWidth;
      line.push(tok);
    }
  }
  flushLine();
}

function drawSub(w: Writer, id: string, boldLead: string | undefined, text: RichText) {
  const label = boldLead ? `${id}. ${boldLead}` : `${id}.`;
  drawParagraph(w, label, { bold: true, indent: 8 });
  drawRichParagraph(w, text, { indent: 8 });
  w.y -= 2;
}

function drawList(w: Writer, items: string[]) {
  for (const item of items) {
    const lines = wrapText(item, w.font, BODY_SIZE, CONTENT_WIDTH - 20);
    lines.forEach((line, i) => {
      ensureSpace(w, BODY_SIZE + LINE_GAP);
      const prefix = i === 0 ? "•  " : "   ";
      w.page.drawText(`${prefix}${line}`, { x: MARGIN + 8, y: w.y - BODY_SIZE, size: BODY_SIZE, font: w.font });
      w.y -= BODY_SIZE + LINE_GAP;
    });
  }
}

function drawTable(w: Writer, headers: string[], rows: string[][]) {
  const colWidth = CONTENT_WIDTH / headers.length;
  ensureSpace(w, BODY_SIZE + 14);
  headers.forEach((h, i) => {
    w.page.drawText(h, { x: MARGIN + i * colWidth, y: w.y - BODY_SIZE, size: BODY_SIZE, font: w.bold });
  });
  w.y -= BODY_SIZE + 6;
  w.page.drawLine({
    start: { x: MARGIN, y: w.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: w.y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  w.y -= 8;
  for (const row of rows) {
    ensureSpace(w, BODY_SIZE + LINE_GAP);
    row.forEach((cell, i) => {
      w.page.drawText(cell, { x: MARGIN + i * colWidth, y: w.y - BODY_SIZE, size: BODY_SIZE, font: w.font });
    });
    w.y -= BODY_SIZE + LINE_GAP;
  }
  w.y -= 6;
}

export async function generateSignedIcaPdf(input: {
  signerName: string;
  signedAt: Date;
  signerIp: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w: Writer = { doc, font, bold, page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN };

  drawParagraph(w, "CnC Realty", { bold: true });
  drawParagraph(w, "Independent Contractor Agreement", { bold: true });
  w.y -= 10;
  drawRichParagraph(w, ICA_INTRO);
  w.y -= 8;

  for (const section of ICA_SECTIONS) {
    ensureSpace(w, BODY_SIZE + LINE_GAP + 14);
    drawParagraph(w, `${section.num}. ${section.title}`, { bold: true });
    w.y -= 2;
    for (const item of section.content) {
      if (item.type === "p") drawRichParagraph(w, item.text);
      else if (item.type === "p-bold") drawParagraph(w, item.text, { bold: true });
      else if (item.type === "sub") drawSub(w, item.id, item.boldLead, item.text);
      else if (item.type === "list") drawList(w, item.items);
      else drawTable(w, item.headers, item.rows);
    }
    w.y -= 10;
  }

  ensureSpace(w, 140);
  drawParagraph(w, "Acknowledgement and Signature", { bold: true });
  w.y -= 4;
  drawParagraph(
    w,
    "I, the undersigned Associate-Licensee, do hereby acknowledge that I have read CnC Realty's Independent Contractor Agreement and agree to abide by its provisions during my association with CnC Realty."
  );
  w.y -= 8;
  drawParagraph(w, `Signed electronically by: ${input.signerName}`, { bold: true });
  drawParagraph(w, `Date/Time: ${input.signedAt.toISOString()}`);
  drawParagraph(w, `IP Address: ${input.signerIp}`);
  drawParagraph(w, `ICA Version: ${ICA_VERSION}`);

  w.y -= 14;
  drawParagraph(w, "Fee Schedule Summary", { bold: true });
  drawTable(w, SUMMARY_TABLE.headers, SUMMARY_TABLE.rows);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
```

**Note:** `{ type: "list" }` items may carry an optional `spacing?: "tight" | "loose"` field (added post-Task-3-review to fix a web-only CSS regression — see the "Task 2/3 Amendment" note after Task 3). This field only affects the web page's `space-y-1`/`space-y-2` Tailwind class; the PDF has no equivalent "original" spacing to regress from; `drawList` intentionally ignores it and uses uniform spacing for all lists. Similarly, `FeeTableBlock`'s web-only `boldLastColumn` prop (also added in that amendment) has no PDF equivalent — `drawTable` always uses `w.bold` for the header row and `w.font` for every body cell, for both the in-section fee table and the standalone summary table.

**Amendment (found during implementation, before formal task review):** the first draft of `tokenizeRichText` always inserted a space between every token, which produces a phantom space when a bold run butts directly against punctuation with no whitespace between them (e.g. "$990" immediately followed by ", inclusive..." in Section 7.2, and "Associate-Licensee" immediately followed by ". In consideration..." in `ICA_INTRO`). The version above tracks `spaceBefore` per token based on actual whitespace adjacency at each run boundary, fixing this. If you already implemented an earlier version without `spaceBefore`, replace `tokenizeRichText` and `drawRichParagraph` with the versions above exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-pdf.test.ts`
Expected: PASS (1 test) — generation may take a second or two, that's expected.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ica-pdf.ts apps/web/src/__tests__/lib/ica-pdf.test.ts
git commit -m "feat: generate signed ICA PDF via pdf-lib"
```

---

### Task 5C: Direct unit test coverage for the phantom-space fix

**Files:**
- Modify: `apps/web/src/lib/ica-pdf.ts` (export `tokenizeRichText` — already applied above in the amended Task 5 code)
- Modify: `apps/web/src/__tests__/lib/ica-pdf.test.ts`

**Why:** The Task 5 reviewer found that the only committed test checks PDF structural validity (magic bytes, page count), which would NOT catch a regression of the phantom-space bug fixed in Task 5B (a stray space doesn't change page count or PDF validity). Since `tokenizeRichText` is a pure function, it's directly and cheaply testable without needing to parse rendered PDF bytes.

- [ ] **Step 1: Add the test**

Append to `apps/web/src/__tests__/lib/ica-pdf.test.ts`:

```ts
import { tokenizeRichText } from "@/lib/ica-pdf";

describe("tokenizeRichText", () => {
  it("does not insert a space when a bold run abuts punctuation with no whitespace", () => {
    const tokens = tokenizeRichText(["is ", { bold: "$990" }, ", inclusive"]);
    const dollarToken = tokens.find((t) => t.word === "$990")!;
    const commaToken = tokens.find((t) => t.word === ",")!;
    expect(dollarToken.bold).toBe(true);
    expect(dollarToken.spaceBefore).toBe(true); // "is " ends with a space
    expect(commaToken.bold).toBe(false);
    expect(commaToken.spaceBefore).toBe(false); // "$990" has no trailing space, "," has no leading space
  });

  it("does not insert a space between a bold run and an immediately-following period", () => {
    const tokens = tokenizeRichText([
      "made between ",
      { bold: "Associate-Licensee" },
      ". In consideration",
    ]);
    const periodToken = tokens.find((t) => t.word === ".")!;
    expect(periodToken.spaceBefore).toBe(false);
  });

  it("still spaces normal words within a single run", () => {
    const tokens = tokenizeRichText("plain text with several words");
    expect(tokens.every((t, i) => (i === 0 ? true : t.spaceBefore))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter web exec vitest run src/__tests__/lib/ica-pdf.test.ts`
Expected: PASS (4 tests — the original PDF-validity test plus these 3 new ones)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/ica-pdf.ts apps/web/src/__tests__/lib/ica-pdf.test.ts
git commit -m "test: cover the phantom-space fix directly via tokenizeRichText"
```

---

### Task 6: Schema migration — signature + signed-ICA fields

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `AgentApplication.signedName: String`, `AgentApplication.icaVersion: String`, `AgentApplication.signedIcaKey: String?`, `Agent.signedIcaKey: String?` — consumed by Tasks 7 and 9.

- [ ] **Step 1: Edit the schema**

In `packages/database/prisma/schema.prisma`, add to the `AgentApplication` model (right after the existing `// ICA audit trail` block):

```prisma
  // ICA audit trail
  icaOpenedAt  DateTime
  icaAgreedAt  DateTime
  submissionIp String
  signedName   String
  icaVersion   String
  signedIcaKey String?
```

Add to the `Agent` model (after `propertiesRented`):

```prisma
  propertiesRented Int      @default(0)
  signedIcaKey     String?
```

- [ ] **Step 2: Stop any running dev server / node processes (Windows EPERM guard)**

Run (PowerShell): `Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue`

- [ ] **Step 3: Generate and apply the migration**

Run: `pnpm --filter @cnc/database exec prisma migrate dev --name add_signed_ica`
Expected: creates `packages/database/prisma/migrations/<timestamp>_add_signed_ica/migration.sql` and applies it to the Railway DB; Prisma Client regenerates without EPERM errors.

- [ ] **Step 4: Verify the generated client has the new fields**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors (confirms `Prisma.AgentApplicationCreateInput` and `Prisma.AgentCreateInput` now include the new fields)

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat: add signedName/icaVersion/signedIcaKey to AgentApplication and Agent"
```

---

### Task 7: Wire signing + PDF generation into the application POST route

**Files:**
- Modify: `apps/web/src/app/api/agent-applications/route.ts`
- Modify: `apps/web/src/__tests__/api/agent-applications.test.ts`

**Interfaces:**
- Consumes: `namesMatch` (Task 4), `generateSignedIcaPdf` (Task 5), `uploadToR2` (existing `@/lib/r2.ts`), `ICA_VERSION` (Task 2)

- [ ] **Step 1: Update the failing/existing test file first**

Add `signatureName: 'Jane Smith'` to `VALID_BODY` (matches `firstName: 'Jane'`, `lastName: 'Smith'` already in the fixture), add mocks for the new modules, and add a new test for the mismatch case:

```ts
// apps/web/src/__tests__/api/agent-applications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentApplication: { create: vi.fn() },
  },
}));
vi.mock('@/lib/email', () => ({
  sendApplicationNotification: vi.fn(),
}));
vi.mock('@/lib/ica-pdf', () => ({
  generateSignedIcaPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
}));
vi.mock('@/lib/r2', () => ({
  uploadToR2: vi.fn().mockResolvedValue(undefined),
}));

// Mock reCAPTCHA verification — success by default
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ success: true, score: 0.9 }),
} as any);

import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2';
import { POST } from '../../app/api/agent-applications/route';

const VALID_BODY = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  phone: '5551234567',
  address: '123 Main St',
  city: 'Los Angeles',
  state: 'CA',
  zip: '90001',
  dateOfBirth: '1985-06-15',
  licenseNumber: '01234567',
  licenseType: 'SALESPERSON',
  licenseExpDate: '2027-01-01',
  yearsLicensed: 5,
  formerBrokerage: 'Keller Williams',
  boardOfRealtors: '',
  mlsId: '',
  hasActiveListings: false,
  hasActiveSales: false,
  commissionEntity: 'PERSONAL',
  hasDisciplinaryHistory: false,
  disciplinaryExplain: '',
  hasInvestigationHistory: false,
  investigationExplain: '',
  drePerJuryCert: true,
  specialties: ['Residential'],
  bio: '',
  instagramUrl: '',
  facebookUrl: '',
  icaOpenedAt: '2026-06-30T14:00:00.000Z',
  icaAgreedAt: '2026-06-30T14:05:00.000Z',
  signatureName: 'Jane Smith',
  recaptchaToken: 'valid-token',
};

describe('POST /api/agent-applications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 if licenseNumber is not 8 digits', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, licenseNumber: '1234' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if required fields are missing', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, firstName: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if drePerJuryCert is false', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, drePerJuryCert: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("certification required");
  });

  it('returns 400 if signatureName does not match firstName/lastName', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, signatureName: 'John Doe' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Signature must match');
  });

  it('persists desiredMembershipAssociation when provided', async () => {
    vi.mocked(prisma.agentApplication.create).mockResolvedValue({ id: 'app-2' } as any);
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, boardOfRealtors: 'Undecided', desiredMembershipAssociation: 'Ventura Coastal Association of REALTORS' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(prisma.agentApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          desiredMembershipAssociation: 'Ventura Coastal Association of REALTORS',
        }),
      })
    );
  });

  it('creates application and returns 201 for valid submission, with a signed ICA PDF uploaded to R2', async () => {
    vi.mocked(prisma.agentApplication.create).mockResolvedValue({ id: 'app-1' } as any);
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('app-1');

    expect(uploadToR2).toHaveBeenCalledWith(
      expect.stringMatching(/^signed-ica\/.+\.pdf$/),
      expect.any(Buffer),
      'application/pdf'
    );

    expect(prisma.agentApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'jane@example.com',
          licenseNumber: '01234567',
          submissionIp: '1.2.3.4',
          signedName: 'Jane Smith',
          signedIcaKey: expect.stringMatching(/^signed-ica\/.+\.pdf$/),
          icaVersion: expect.any(String),
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify the new assertions fail**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications.test.ts`
Expected: FAIL — `signatureName` not in zod schema yet, `signedName`/`icaVersion`/`signedIcaKey` not persisted yet, `uploadToR2` never called.

- [ ] **Step 3: Update the route**

```ts
// apps/web/src/app/api/agent-applications/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendApplicationNotification } from "@/lib/email";
import { namesMatch } from "@/lib/ica-signature";
import { generateSignedIcaPdf } from "@/lib/ica-pdf";
import { uploadToR2 } from "@/lib/r2";
import { ICA_VERSION } from "@/lib/ica-content";

const schema = z.object({
  firstName:      z.string().min(1, "First name required"),
  lastName:       z.string().min(1, "Last name required"),
  email:          z.string().email("Valid email required"),
  phone:          z.string().min(1, "Phone required"),
  address:        z.string().min(1, "Address required"),
  city:           z.string().min(1, "City required"),
  state:          z.string().min(1, "State required"),
  zip:            z.string().min(1, "ZIP required"),
  dateOfBirth:    z.string().min(1, "Date of birth required"),
  licenseNumber:  z.string().regex(/^\d{8}$/, "CA DRE license must be exactly 8 digits"),
  licenseType:    z.enum(["SALESPERSON", "BROKER_ASSOCIATE"]),
  licenseExpDate: z.string().min(1, "License expiration date required"),
  yearsLicensed:  z.number().int().min(0),
  formerBrokerage:z.string().optional().default(""),
  boardOfRealtors:z.string().optional().default(""),
  desiredMembershipAssociation: z.string().optional().default(""),
  mlsId:          z.string().optional().default(""),
  hasActiveListings:       z.boolean(),
  hasActiveSales:          z.boolean(),
  commissionEntity:        z.enum(["PERSONAL", "LLC", "S_CORP", "C_CORP"]),
  hasDisciplinaryHistory:  z.boolean(),
  disciplinaryExplain:     z.string().optional().default(""),
  hasInvestigationHistory: z.boolean(),
  investigationExplain:    z.string().optional().default(""),
  drePerJuryCert:          z.boolean().refine((v) => v === true, { message: "DRE certification required" }),
  specialties:    z.array(z.string()).default([]),
  bio:            z.string().optional().default(""),
  instagramUrl:   z.string().optional().default(""),
  facebookUrl:    z.string().optional().default(""),
  icaOpenedAt:    z.string().datetime(),
  icaAgreedAt:    z.string().datetime(),
  signatureName:  z.string().min(1, "Signature required"),
  recaptchaToken: z.string().min(1, "reCAPTCHA token required"),
});

async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!process.env.RECAPTCHA_SECRET_KEY) return true; // skip in dev if not configured
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.success === true && (data.score ?? 1) >= 0.5;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    if (!namesMatch(data.signatureName, data.firstName, data.lastName)) {
      return NextResponse.json(
        { error: "Signature must match your full legal name (First + Last Name) entered above." },
        { status: 400 }
      );
    }

    const recaptchaOk = await verifyRecaptcha(data.recaptchaToken);
    if (!recaptchaOk) {
      return NextResponse.json({ error: "reCAPTCHA verification failed. Please try again." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

    const applicationId = randomUUID();
    const signedAt = new Date(data.icaAgreedAt);
    const pdfBuffer = await generateSignedIcaPdf({
      signerName: data.signatureName,
      signedAt,
      signerIp: ip,
    });
    const signedIcaKey = `signed-ica/${applicationId}.pdf`;
    await uploadToR2(signedIcaKey, pdfBuffer, "application/pdf");

    const app = await prisma.agentApplication.create({
      data: {
        id:              applicationId,
        firstName:       data.firstName,
        lastName:        data.lastName,
        email:           data.email,
        phone:           data.phone,
        address:         data.address,
        city:            data.city,
        state:           data.state,
        zip:             data.zip,
        dateOfBirth:     data.dateOfBirth,
        licenseNumber:   data.licenseNumber,
        licenseType:     data.licenseType,
        licenseExpDate:  data.licenseExpDate,
        yearsLicensed:   data.yearsLicensed,
        formerBrokerage: data.formerBrokerage,
        boardOfRealtors: data.boardOfRealtors || null,
        desiredMembershipAssociation: data.desiredMembershipAssociation || null,
        mlsId:           data.mlsId || null,
        hasActiveListings:       data.hasActiveListings,
        hasActiveSales:          data.hasActiveSales,
        commissionEntity:        data.commissionEntity,
        hasDisciplinaryHistory:  data.hasDisciplinaryHistory,
        disciplinaryExplain:     data.disciplinaryExplain || null,
        hasInvestigationHistory: data.hasInvestigationHistory,
        investigationExplain:    data.investigationExplain || null,
        drePerJuryCert:          data.drePerJuryCert,
        specialties:    data.specialties,
        bio:            data.bio || null,
        instagramUrl:   data.instagramUrl || null,
        facebookUrl:    data.facebookUrl || null,
        icaOpenedAt:    new Date(data.icaOpenedAt),
        icaAgreedAt:    signedAt,
        submissionIp:   ip,
        signedName:     data.signatureName,
        icaVersion:     ICA_VERSION,
        signedIcaKey,
      },
    });

    Promise.resolve(sendApplicationNotification(app)).catch(console.error);

    return NextResponse.json({ id: app.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/agent-applications]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/agent-applications/route.ts apps/web/src/__tests__/api/agent-applications.test.ts
git commit -m "feat: capture signature, generate signed ICA PDF, upload to R2 on application submit"
```

---

### Task 8: ApplicationForm — signature field UI

**Files:**
- Modify: `apps/web/src/components/join/ApplicationForm.tsx`

**Interfaces:**
- Consumes: `namesMatch` from `@/lib/ica-signature` (Task 4)

- [ ] **Step 1: Add `signatureName` to `FormState` and `INITIAL`**

In `apps/web/src/components/join/ApplicationForm.tsx`, modify the `FormState` interface (around line 33-60):

```ts
interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dateOfBirth: string;
  licenseNumber: string;
  licenseType: LicenseType | "";
  licenseExpDate: string;
  yearsLicensed: string;
  formerBrokerage: string;
  boardOfRealtors: string;
  desiredMembershipAssociation: string;
  mlsId: string;
  hasActiveListings: boolean | null;
  hasActiveSales: boolean | null;
  commissionEntity: CommissionEntity | "";
  hasDisciplinaryHistory: boolean | null;
  disciplinaryExplain: string;
  hasInvestigationHistory: boolean | null;
  investigationExplain: string;
  icaAgreed: boolean;
  signatureName: string;
  drePerJuryCert: boolean;
}
```

And `INITIAL` (around line 62-72):

```ts
const INITIAL: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  address: "", city: "", state: "CA", zip: "", dateOfBirth: "",
  licenseNumber: "", licenseType: "", licenseExpDate: "", yearsLicensed: "",
  formerBrokerage: "", boardOfRealtors: "", desiredMembershipAssociation: "", mlsId: "",
  hasActiveListings: null, hasActiveSales: null,
  commissionEntity: "",
  hasDisciplinaryHistory: null, disciplinaryExplain: "",
  hasInvestigationHistory: null, investigationExplain: "",
  icaAgreed: false, signatureName: "", drePerJuryCert: false,
};
```

- [ ] **Step 2: Add the import**

Near the top of the file, alongside the other `@/lib` imports (around line 10):

```ts
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";
import { namesMatch } from "@/lib/ica-signature";
```

- [ ] **Step 3: Add client-side validation in `handleSubmit`**

Right after the existing `if (!form.icaAgreed) {...}` block (around line 148-151), insert:

```ts
    if (!form.icaAgreed) {
      setError("You must agree to the Independent Contractor Agreement.");
      return;
    }
    if (!namesMatch(form.signatureName, form.firstName, form.lastName)) {
      setError("Your signature must match your full legal name (First + Last Name) entered above.");
      return;
    }
    if (!form.drePerJuryCert) {
      setError("DRE perjury certification is required.");
      return;
    }
```

- [ ] **Step 4: Add the signature input to the UI**

In the "Section 3: ICA Review & Agreement" block, right after the existing checkbox `<label>` (currently the last element before the closing `</div>` of that section, around line 366-379):

```tsx
        <label
          className={`flex cursor-pointer items-start gap-3 font-sans text-sm text-[#1B1B1B] ${
            !icaOpened ? "cursor-not-allowed opacity-40" : ""
          }`}
        >
          <input
            type="checkbox"
            disabled={!icaOpened}
            checked={form.icaAgreed}
            onChange={(e) => set("icaAgreed", e.target.checked)}
            className="mt-0.5 accent-[#9E8C61]"
          />
          I have read and agree to the CnC Realty Independent Contractor Agreement. *
        </label>
        <div className="mt-4">
          <label className={labelClass}>Type your full legal name to sign *</label>
          <input
            className={inputClass}
            value={form.signatureName}
            onChange={(e) => set("signatureName", e.target.value)}
            disabled={!icaOpened}
          />
          <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">
            By typing your name above, you are electronically signing the CnC Realty Independent Contractor Agreement.
          </p>
        </div>
```

(`form.signatureName` is already included in the POST body automatically since the fetch call spreads `...form` — no change needed there.)

- [ ] **Step 5: Verify the build compiles**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors referencing `ApplicationForm.tsx`

- [ ] **Step 6: Manual check**

Run: `pnpm --filter web dev`, open `/join/apply`, fill the form with a signature name that does NOT match First/Last Name, submit — confirm the inline error appears. Then correct it to match and confirm submission proceeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/join/ApplicationForm.tsx
git commit -m "feat: add typed-name signature field to agent application"
```

---

### Task 9: Approve route — copy `signedIcaKey` onto the new Agent

**Files:**
- Modify: `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`
- Test: `apps/web/src/__tests__/api/agent-applications-approve.test.ts`

**Interfaces:**
- Consumes: `AgentApplication.signedIcaKey`, `Agent.signedIcaKey` (Task 6)

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/api/agent-applications-approve.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendApplicationApproved: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-password") } }));
vi.mock("@/lib/prisma", () => {
  const mockPrisma: any = {
    agentApplication: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { create: vi.fn() },
    agent: { create: vi.fn() },
  };
  mockPrisma.$transaction = vi.fn(async (cb: any) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "../../app/api/agent-applications/[id]/approve/route";

describe("POST /api/agent-applications/[id]/approve", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies signedIcaKey from the application onto the new Agent record", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
      id: "app-1",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-123-4567",
      licenseNumber: "01234567",
      yearsLicensed: 5,
      specialties: [],
      bio: null,
      instagramUrl: null,
      facebookUrl: null,
      signedIcaKey: "signed-ica/app-1.pdf",
    } as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-1" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-1/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-1" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signedIcaKey: "signed-ica/app-1.pdf" }),
      })
    );
  });

  it("sets signedIcaKey to null on the new Agent when the application has none", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { email: "admin@cnc.com" } },
      error: undefined,
    } as any);
    vi.mocked(prisma.agentApplication.findUnique).mockResolvedValue({
      id: "app-2",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-987-6543",
      licenseNumber: "09876543",
      yearsLicensed: 2,
      specialties: [],
      bio: null,
      instagramUrl: null,
      facebookUrl: null,
      signedIcaKey: null,
    } as any);
    vi.mocked(prisma.agentApplication.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "user-2" } as any);
    vi.mocked(prisma.agent.create).mockResolvedValue({ id: "agent-2" } as any);

    const req = new Request("http://localhost/api/agent-applications/app-2/approve", { method: "POST" });
    const res = await POST(req, { params: { id: "app-2" } });

    expect(res.status).toBe(200);
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signedIcaKey: null }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications-approve.test.ts`
Expected: FAIL — `signedIcaKey` not yet passed to `tx.agent.create`.

- [ ] **Step 3: Update the route**

In `apps/web/src/app/api/agent-applications/[id]/approve/route.ts`, modify the `tx.agent.create` call inside the transaction:

```ts
      await tx.agent.create({
        data: {
          userId: user.id,
          slug,
          displayName: `${app.firstName} ${app.lastName}`,
          phone: app.phone,
          licenseNum: app.licenseNumber,
          licenseState: "CA",
          yearsExp: app.yearsLicensed,
          specialties: app.specialties,
          bio: app.bio ?? undefined,
          instagram: app.instagramUrl ?? undefined,
          facebook: app.facebookUrl ?? undefined,
          signedIcaKey: app.signedIcaKey,
        },
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/agent-applications-approve.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/agent-applications/[id]/approve/route.ts apps/web/src/__tests__/api/agent-applications-approve.test.ts
git commit -m "feat: carry signedIcaKey from application to agent on approval"
```

---

### Task 10: Admin download route

**Files:**
- Create: `apps/web/src/app/api/admin/agents/[id]/signed-ica/route.ts`
- Test: `apps/web/src/__tests__/api/admin-agents-signed-ica.test.ts`

**Interfaces:**
- Consumes: `requireAuth` (existing `@/lib/api-auth`), `getPresignedGetUrl` (existing `@/lib/r2.ts`)
- Produces: `GET /api/admin/agents/[id]/signed-ica` → `{ url: string }` (200) or `{ error: string }` (404) — consumed by Task 11.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/__tests__/api/admin-agents-signed-ica.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { agent: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/r2", () => ({
  getPresignedGetUrl: vi.fn(),
}));

import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";
import { GET } from "../../app/api/admin/agents/[id]/signed-ica/route";

describe("GET /api/admin/agents/[id]/signed-ica", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the agent has no signed ICA on file", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ error: undefined } as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ signedIcaKey: null } as any);

    const req = new Request("http://localhost/api/admin/agents/agent-1/signed-ica");
    const res = await GET(req, { params: { id: "agent-1" } });

    expect(res.status).toBe(404);
  });

  it("returns a presigned url when the agent has a signed ICA on file", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ error: undefined } as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ signedIcaKey: "signed-ica/app-1.pdf" } as any);
    vi.mocked(getPresignedGetUrl).mockResolvedValue("https://r2.example.com/signed-url");

    const req = new Request("http://localhost/api/admin/agents/agent-1/signed-ica");
    const res = await GET(req, { params: { id: "agent-1" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://r2.example.com/signed-url");
    expect(getPresignedGetUrl).toHaveBeenCalledWith("signed-ica/app-1.pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/api/admin-agents-signed-ica.test.ts`
Expected: FAIL with "Cannot find module '.../app/api/admin/agents/[id]/signed-ica/route'"

- [ ] **Step 3: Write the route**

```ts
// apps/web/src/app/api/admin/agents/[id]/signed-ica/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getPresignedGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAuth("ADMIN");
  if (error) return error;

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    select: { signedIcaKey: true },
  });

  if (!agent?.signedIcaKey) {
    return NextResponse.json({ error: "No signed ICA on file" }, { status: 404 });
  }

  const url = await getPresignedGetUrl(agent.signedIcaKey);
  return NextResponse.json({ url });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/api/admin-agents-signed-ica.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/admin/agents/[id]/signed-ica/route.ts" apps/web/src/__tests__/api/admin-agents-signed-ica.test.ts
git commit -m "feat: admin route to fetch a presigned download url for a signed ICA"
```

---

### Task 11: Admin `/admin/agents` — download button

**Files:**
- Create: `apps/web/src/app/(dashboard)/admin/agents/DownloadIcaButton.tsx`
- Modify: `apps/web/src/app/(dashboard)/admin/agents/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/agents/[id]/signed-ica` (Task 10)

No automated test for this task — it's a thin UI wrapper around an already-tested API route, consistent with how `AgentTitleEditor.tsx` (the existing sibling component doing the same kind of thing) has no test file either. Verified manually.

- [ ] **Step 1: Create the button component**

```tsx
// apps/web/src/app/(dashboard)/admin/agents/DownloadIcaButton.tsx
"use client";

import { useState } from "react";

export function DownloadIcaButton({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/signed-ica`);
      if (!res.ok) return;
      const { url } = await res.json();
      window.open(url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded px-2 py-1 text-xs font-medium text-[#9E8C61] transition-colors hover:bg-[#9E8C61]/10 disabled:opacity-40"
    >
      {loading ? "…" : "Download Signed ICA"}
    </button>
  );
}
```

- [ ] **Step 2: Wire it into the admin agents table**

In `apps/web/src/app/(dashboard)/admin/agents/page.tsx`:

Add the import (alongside the other component imports):

```ts
import { DownloadIcaButton } from "./DownloadIcaButton";
```

Add `signedIcaKey` to the `AgentRow` type:

```ts
  type AgentRow = {
    id: string;
    slug: string;
    title: string | null;
    licenseNum: string | null;
    createdAt: Date;
    signedIcaKey: string | null;
    user: { email: string; role: string; createdAt: Date };
    _count: { leads: number };
  };
```

Add `"Signed ICA"` to the `headers` array in the `<AdminTable>` call:

```tsx
        <AdminTable
          headers={["Agent Name", "Email", "Title", "License", "Leads", "Joined", "Role", "Signed ICA", "Actions"]}
        >
```

Add a new `<td>` for the signed ICA column, right before the existing "Actions" `<td>` (the one containing `<PromoteButton>`):

```tsx
              <td className="px-4 py-3">
                {agent.signedIcaKey ? (
                  <DownloadIcaButton agentId={agent.id} />
                ) : (
                  <span className="text-[#1B1B1B]/30">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {agent.user.role === "AGENT" ? (
                  <PromoteButton agentId={agent.id} />
                ) : (
                  <span className="text-[#1B1B1B]/30">—</span>
                )}
              </td>
```

(No change needed to the `prisma.agent.findMany` call itself — it uses no `select`, so all scalar fields including the new `signedIcaKey` column come back automatically once Task 6's migration is applied.)

- [ ] **Step 3: Verify the build compiles**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no new errors referencing `admin/agents/page.tsx` or `DownloadIcaButton.tsx`

- [ ] **Step 4: Manual check**

Run: `pnpm --filter web dev`, log in as ADMIN, open `/admin/agents` — confirm the new "Signed ICA" column shows `—` for existing agents (none have a `signedIcaKey` yet) and, after running through a full test application submission + approval, shows a working "Download Signed ICA" button that opens the PDF in a new tab.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/admin/agents/DownloadIcaButton.tsx" "apps/web/src/app/(dashboard)/admin/agents/page.tsx"
git commit -m "feat: download signed ICA button on admin agents table"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture/data flow → Tasks 6–11. ICA content consolidation → Tasks 2–3. Signing flow → Tasks 4, 7, 8. PDF generation → Task 5. Storage & download → Tasks 10–11. Testing → covered inline in every task via TDD steps. All spec sections have a corresponding task.
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `namesMatch(signatureName, firstName, lastName)` signature is identical in Task 4's implementation, Task 7's server-side call, and Task 8's client-side call. `generateSignedIcaPdf({ signerName, signedAt, signerIp })` matches between Task 5's definition and Task 7's call site. `IcaParagraph`/`IcaSection` shapes match between Task 2's definition, Task 3's consumption, and Task 5's consumption.
