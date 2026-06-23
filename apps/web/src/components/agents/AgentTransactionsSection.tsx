import { Home, MapPin } from "lucide-react";

export type AgentTransaction = {
  id: string;
  propertyAddress: string;
  city: string;
  state: string;
  transactionSide: "BUYER_SIDE" | "SELLER_SIDE" | "DUAL" | "LEASE";
  salePrice: number | null;
  listPrice: number | null;
  closeOfEscrow: string | null;
};

const SIDE_LABEL: Record<AgentTransaction["transactionSide"], string> = {
  BUYER_SIDE:  "Buyer's Agent",
  SELLER_SIDE: "Seller's Agent",
  DUAL:        "Dual Agent",
  LEASE:       "Lease",
};

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(price / 1_000)}K`;
}

export function AgentTransactionsSection({
  transactions,
}: {
  transactions: AgentTransaction[];
  displayName: string;
}) {
  if (transactions.length === 0) return null;

  return (
    <section className="bg-white px-6 py-20 md:px-12 lg:px-20">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
          Track Record
        </p>
        <h2
          className="mb-12 font-sans font-medium leading-[1.1] text-[#1B1B1B]"
          style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", letterSpacing: "-0.02em" }}
        >
          Past Transactions
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {transactions.map((tx) => {
            const price = tx.salePrice ?? tx.listPrice;
            return (
              <div
                key={tx.id}
                className="flex flex-col rounded-2xl border border-[#E8E5E0] bg-[#F9F8F7] p-5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#9E8C61]/10">
                  <Home size={17} className="text-[#9E8C61]" />
                </div>

                <p className="font-sans text-sm font-medium leading-tight text-[#1B1B1B]">
                  {tx.propertyAddress}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[#1B1B1B]/40">
                  <MapPin size={11} />
                  <p className="font-sans text-xs">
                    {tx.city}, {tx.state}
                  </p>
                </div>

                <div className="mt-5 flex items-end justify-between gap-2">
                  {price != null && (
                    <p
                      className="font-sans font-semibold text-[#1B1B1B]"
                      style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.35rem)", letterSpacing: "-0.01em" }}
                    >
                      {formatPrice(price)}
                    </p>
                  )}
                  <span className="shrink-0 rounded-full bg-[#9E8C61]/10 px-2.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-[#9E8C61]">
                    {SIDE_LABEL[tx.transactionSide]}
                  </span>
                </div>

                {tx.closeOfEscrow && (
                  <p className="mt-2 font-sans text-[10px] text-[#1B1B1B]/30">
                    Closed{" "}
                    {new Date(tx.closeOfEscrow).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
