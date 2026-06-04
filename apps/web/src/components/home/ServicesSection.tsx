"use client";

import {
  motion,
  MotionValue,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { RevealText, RevealLine } from "@/components/ui/reveal-text";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

const CARDS = [
  {
    label: "Buy",
    img: "/images/services-buy.jpg",
    style: { left: "39%", top: "4%" } satisfies CSSProperties,
    delay: 0,
    width: "22%",
    parallax: 0,
    description:
      "Whether you're a first time buyer or a seasoned investor, the mission remains the same - ensure you achieve your goals with top tier service. A CnC agent will guide you through every step from search to close, providing local expertise and full CRMLS access.",
  },
  {
    label: "Sell",
    img: "/images/services-sell.jpg",
    style: { left: "9%", top: "32%" } satisfies CSSProperties,
    delay: 0.12,
    width: "22%",
    parallax: 200,
    description:
      "Get your home or property in front of serious buyers fast. We deliver premium marketing with the latest tech, data-driven pricing, and skilled negotiation to maximize your sale. Give us the opportunity to handle the headache so you can have peace of mind.",
  },
  {
    label: "Rent",
    img: "/images/services-lease.jpg",
    style: { right: "45%", top: "62%" } satisfies CSSProperties,
    delay: 0.22,
    width: "18%",
    parallax: 200,
    description:
      "Looking to make a move? CnC is here to provide you a white-glove experience during your transition into an ideal home. Our team of expert agents will help guide you into the right direction.",
  },
  {
    label: "Property Management",
    img: "/images/services-manage.jpg",
    style: { right: "8%", top: "52%" } satisfies CSSProperties,
    delay: 0.32,
    width: "22%",
    parallax: 450,
    description:
      "Let CnC handle the day-to-day operations of your investment property. Tenant applications, maintenance issues, detailed financial reporting, we do it all. Trusted agents available around the clock giving you peace of mind and time back in your day to do bigger tasks.",
  },
];

// Both flip faces share this — cast once, reference everywhere
const BACKFACE_HIDDEN: CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
} as CSSProperties;

function HouseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function ServiceCard({
  label,
  img,
  style,
  delay,
  width = "22%",
  y,
  description,
}: {
  label: string;
  img: string;
  style: CSSProperties;
  delay: number;
  width?: string;
  y: MotionValue<number>;
  description: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const rectCache = useRef<DOMRect | null>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 180, damping: 22 });
  const springY = useSpring(rawY, { stiffness: 180, damping: 22 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = rectCache.current;
    if (!rect) return;
    rawX.set(e.clientX - rect.left);
    rawY.set(e.clientY - rect.top);
  }

  return (
    <motion.div
      className="absolute"
      style={{ width, y, ...style } as CSSProperties}
    >
      {/* Entry animation wrapper */}
      <motion.div
        ref={cardRef}
        className="relative aspect-[3/4] w-full rounded-2xl"
        initial={{ opacity: 0, y: 52 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
        viewport={{ once: true, margin: "-5%" }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => {
          if (!flipped) {
            setHovered(true);
            rectCache.current = cardRef.current?.getBoundingClientRect() ?? null;
          }
        }}
        onMouseLeave={() => setHovered(false)}
        style={{
          perspective: "1200px",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.32), 0 16px 32px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.12)",
          cursor: hovered && !flipped ? "none" : "auto",
        }}
      >
        {/* Flip container */}
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            transformStyle: "preserve-3d",
            width: "100%",
            height: "100%",
            position: "relative",
            borderRadius: "1rem",
            backgroundColor: "#1B1B1B",
          }}
        >
          {/* Front */}
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-2xl"
            style={BACKFACE_HIDDEN}
            whileHover={flipped ? undefined : "zoom"}
            onClick={() => !flipped && setFlipped(true)}
          >
            <motion.img
              src={img}
              alt={label}
              className="h-full w-full object-cover"
              variants={{ zoom: { scale: 1.07 } }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <span className="text-center font-sans text-4xl font-medium text-white">
                {label}
              </span>
            </div>

            <button
              onClick={() => setFlipped(true)}
              className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-colors hover:bg-white/40"
              aria-label="More info"
            >
              <img src="/icons/plus-thin.svg" alt="" className="h-4 w-4 invert" />
            </button>
          </motion.div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl bg-[#F2F0EF] p-6 ring-1 ring-[#1B1B1B]/15"
            style={{ ...BACKFACE_HIDDEN, transform: "rotateY(180deg)" }}
          >
            <div className="mb-6 h-px w-6 bg-[#1B1B1B]/40" />
            <p className="flex-1 font-sans text-sm leading-relaxed text-[#1B1B1B]/70">
              {description}
            </p>
            <div className="mt-6 flex items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
                className="rounded-full border border-[#1B1B1B] px-5 py-2 text-sm font-medium text-[#1B1B1B] transition-colors hover:bg-[#1B1B1B] hover:text-white"
              >
                {label}
              </motion.button>
              <motion.button
                onClick={() => setFlipped(false)}
                whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
                className="flex h-8 w-8 items-center justify-center text-xl text-[#1B1B1B]/50 transition-colors hover:text-[#1B1B1B]"
                aria-label="Close"
              >
                ×
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Custom cursor — outside overflow-hidden so it's never clipped */}
        {hovered && !flipped && (
          <motion.div
            className="pointer-events-none absolute z-50"
            style={{
              x: springX,
              y: springY,
              translateX: "-50%",
              translateY: "-50%",
              top: 0,
              left: 0,
            }}
          >
            <div className="flex flex-col items-center gap-1.5 border border-white/50 px-4 py-3">
              <HouseIcon />
              <span className="font-sans text-xs font-medium uppercase tracking-[0.18em] text-white">
                View
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function ServicesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({ firstName: "", lastName: "", email: "", phone: "", dealType: "Buy" });
  const [modalStatus, setModalStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setModalStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...modalForm, notes: `Deal type: ${modalForm.dealType}`, source: "WEBSITE" }),
      });
      if (!res.ok) throw new Error();
      setModalStatus("success");
      setModalForm({ firstName: "", lastName: "", email: "", phone: "", dealType: "Buy" });
    } catch {
      setModalStatus("error");
    }
  }

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Buy card has parallax=0 — use a static MotionValue instead of a transform
  const y0 = useMotionValue(0);
  const y1 = useTransform(scrollYProgress, [0, 1], [CARDS[1].parallax, -CARDS[1].parallax]);
  const y2 = useTransform(scrollYProgress, [0, 1], [CARDS[2].parallax, -CARDS[2].parallax]);
  const y3 = useTransform(scrollYProgress, [0, 1], [CARDS[3].parallax, -CARDS[3].parallax]);
  const yValues = [y0, y1, y2, y3];

  return (
    <section data-navbar-theme="light" ref={sectionRef} className="relative bg-[#F2F0EF]" style={{ minHeight: "108vh" }}>
      {/* Heading — top right */}
      <motion.div
        className="absolute right-[8%] top-[14%] text-right"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <h2 className="font-sans font-light leading-[1.0]">
          <span className="block text-[2.5rem] xl:text-[3rem]"><RevealText>See the difference,</RevealText></span>
          <span className="block text-[3.5rem] xl:text-[4.2rem]">
            <RevealLine delay={0.1}>with <span style={{ color: "#9E8C61" }}>CnC</span></RevealLine>
          </span>
        </h2>
        <motion.button
          onClick={() => setModalOpen(true)}
          animate={PULSE_ANIMATE}
          whileHover={{ scale: 1.1, transition: SPRING_HOVER }}
          transition={PULSE_TRANSITION}
          className="ml-auto mt-6 flex w-fit items-center rounded-full bg-[#1B1B1B] px-7 py-3.5 text-sm font-medium text-white"
        >
          Let&apos;s Start
        </motion.button>
      </motion.div>

      {CARDS.map((card, i) => (
        <ServiceCard key={card.label} {...card} y={yValues[i]} />
      ))}

      {/* Lead capture modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setModalOpen(false); setModalStatus("idle"); setModalForm({ firstName: "", lastName: "", email: "", phone: "", dealType: "Buy" });} }}
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => { setModalOpen(false); setModalStatus("idle"); setModalForm({ firstName: "", lastName: "", email: "", phone: "", dealType: "Buy" });}}
              className="absolute right-4 top-4 text-[#1B1B1B]/40 hover:text-[#1B1B1B]"
            >
              ✕
            </button>
            {modalStatus === "success" ? (
              <div className="py-8 text-center">
                <p className="font-sans text-lg font-light text-[#1B1B1B]">Got it — we&apos;ll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={handleModalSubmit} className="flex flex-col gap-5">
                <h2 className="font-sans text-2xl font-light text-[#1B1B1B]">Let&apos;s get started.</h2>
                <div className="grid grid-cols-2 gap-4">
                  {(["firstName", "lastName"] as const).map((k) => (
                    <div key={k} className="flex flex-col gap-1">
                      <label className="font-sans text-xs text-[#1B1B1B]/50">{k === "firstName" ? "First Name *" : "Last Name *"}</label>
                      <input
                        required
                        value={modalForm[k]}
                        onChange={(e) => setModalForm((f) => ({ ...f, [k]: e.target.value }))}
                        className="border-b border-[#1B1B1B]/20 bg-transparent py-1.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/60"
                      />
                    </div>
                  ))}
                </div>
                {(["email", "phone"] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <label className="font-sans text-xs text-[#1B1B1B]/50">{k === "email" ? "Email *" : "Phone"}</label>
                    <input
                      type={k === "email" ? "email" : "tel"}
                      required={k === "email"}
                      value={modalForm[k]}
                      onChange={(e) => setModalForm((f) => ({ ...f, [k]: e.target.value }))}
                      className="border-b border-[#1B1B1B]/20 bg-transparent py-1.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/60"
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <label className="font-sans text-xs text-[#1B1B1B]/50">I&apos;m looking to…</label>
                  <select
                    value={modalForm.dealType}
                    onChange={(e) => setModalForm((f) => ({ ...f, dealType: e.target.value }))}
                    className="border-b border-[#1B1B1B]/20 bg-transparent py-1.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#1B1B1B]/60"
                  >
                    {["Buy", "Sell", "Rent", "Property Management"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                {modalStatus === "error" && (
                  <p className="font-sans text-xs text-red-500">Something went wrong. Please try again.</p>
                )}
                <button
                  type="submit"
                  disabled={modalStatus === "loading"}
                  className="w-full rounded-full bg-[#1B1B1B] py-3 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {modalStatus === "loading" ? "Sending…" : "Next →"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
