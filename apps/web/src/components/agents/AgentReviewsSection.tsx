import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const PLACEHOLDER_REVIEWS = [
  {
    text: "Working with this agent was an incredible experience. They were professional, knowledgeable, and made the entire process seamless.",
    author: "Sarah M.",
    role: "Home Buyer",
  },
  {
    text: "Highly recommend! They went above and beyond to get our home sold quickly and at a great price. Truly exceptional service.",
    author: "James T.",
    role: "Home Seller",
  },
  {
    text: "As a first-time buyer I had a lot of questions. They were patient, thorough, and helped me find the perfect home.",
    author: "Priya K.",
    role: "First-Time Buyer",
  },
];

export function AgentReviewsSection({ displayName }: { displayName: string }) {
  void displayName;
  return (
    <section className="bg-cnc-bg px-6 py-20 md:px-12 lg:px-20">
      <div className="mx-auto max-w-6xl">
        {/* Header row */}
        <div className="mb-12 flex items-start justify-between gap-8">
          <div>
            <p className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-[#9E8C61]">
              Testimonials
            </p>
            <h2
              className="font-sans font-medium leading-[1.1] text-[#1B1B1B]"
              style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", letterSpacing: "-0.02em" }}
            >
              Client reviews
              <br />
              <span className="text-[#9B9B9B]">&amp; testimonials</span>
            </h2>
          </div>

          {/* Decorative quote mark */}
          <svg
            className="hidden shrink-0 opacity-[0.08] md:block"
            width="72"
            height="58"
            viewBox="0 0 72 58"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 58V36C0 16.2 12.9 4.8 38.7 0L43.1 7.2C32.2 9.6 25.5 14.7 22.1 22.5H32.4V58H0ZM39.6 58V36C39.6 16.2 52.5 4.8 78.3 0L82.7 7.2C71.8 9.6 65.1 14.7 61.7 22.5H72V58H39.6Z"
              fill="#1B1B1B"
            />
          </svg>
        </div>

        {/* Review cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {PLACEHOLDER_REVIEWS.map((review) => (
            <div
              key={review.author}
              className="flex flex-col rounded-2xl border border-[#E0DDD8] bg-white p-6"
            >
              <div className="mb-4 flex gap-0.5">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    size={13}
                    className="fill-[#9E8C61] text-[#9E8C61]"
                  />
                ))}
              </div>
              <p className="mb-5 flex-1 font-sans text-sm leading-relaxed text-[#1B1B1B]/60 italic">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E5E0] font-sans text-xs font-medium text-[#1B1B1B]/50">
                  {review.author[0]}
                </div>
                <div>
                  <p className="font-sans text-xs font-semibold text-[#1B1B1B]">
                    {review.author}
                  </p>
                  <p className="font-sans text-[10px] text-[#1B1B1B]/40">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label="Previous reviews"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1B1B1B]/20 text-[#1B1B1B]/55 transition-colors hover:border-[#1B1B1B]/45 hover:text-[#1B1B1B]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next reviews"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1B1B1B]/20 text-[#1B1B1B]/55 transition-colors hover:border-[#1B1B1B]/45 hover:text-[#1B1B1B]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
