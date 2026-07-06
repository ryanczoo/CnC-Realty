// apps/web/src/app/(marketing)/join/ica/page.tsx
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
