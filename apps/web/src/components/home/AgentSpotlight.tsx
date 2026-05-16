"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { RevealText } from "@/components/ui/reveal-text";

const AGENTS = [
  {
    id: 1,
    name: "Ryan Chong",
    label: "Broker of Record",
    stats: "50+ Transactions",
    image: "https://picsum.photos/seed/agent1/400/400",
    rotate: -9,
    bg: "#0c1015",
  },
  {
    id: 2,
    name: "Sarah Martinez",
    label: "Listing Specialist",
    stats: "32 Closed",
    image: "https://picsum.photos/seed/agent2/400/400",
    rotate: 4,
    bg: "#0f0c14",
  },
  {
    id: 3,
    name: "Elena Torres",
    label: "Luxury Specialist",
    stats: "40 Closed",
    image: "https://picsum.photos/seed/agent3/400/400",
    rotate: -3,
    bg: "#0e1210",
  },
  {
    id: 4,
    name: "James Kim",
    label: "Buyer's Agent",
    stats: "28 Closed",
    image: "https://picsum.photos/seed/agent4/400/400",
    rotate: 7,
    bg: "#130d0d",
  },
  {
    id: 5,
    name: "David Chen",
    label: "Investment Expert",
    stats: "45 Closed",
    image: "https://picsum.photos/seed/agent5/400/400",
    rotate: -6,
    bg: "#0d1215",
  },
];

export function AgentSpotlight() {
  return (
    <section className="relative overflow-hidden bg-[#F2F0EF] py-24">
      {/* Header */}
      <div className="mb-16 px-4 text-center">
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: "var(--brand-gold)" }}
        >
          Meet the Team
        </p>
        <h2 className="mt-3 font-display text-5xl font-light uppercase tracking-wide">
          <RevealText>Agent Spotlight</RevealText>
        </h2>
        <div className="mx-auto mt-5 h-px w-16 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
      </div>

      {/* Tilted card fan — extends slightly past viewport edges */}
      <div
        className="flex items-center justify-center gap-5"
        style={{ marginLeft: "-6%", marginRight: "-6%" }}
      >
        {AGENTS.map((agent) => (
          <motion.div
            key={agent.id}
            initial={{ rotate: agent.rotate, y: 0, scale: 1, zIndex: 1 }}
            whileHover={{ rotate: 0, y: -20, scale: 1.06, zIndex: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl"
            style={{
              width: 260,
              height: 347,
              background: agent.bg,
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Bottom gold glow */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(201,168,76,0.12) 0%, transparent 55%)",
              }}
            />

            {/* Agent title label — top left */}
            <span className="absolute left-4 top-4 z-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              {agent.label}
            </span>

            {/* Circular agent photo — slightly above center */}
            <div className="absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-1/2">
              <div
                className="h-[130px] w-[130px] overflow-hidden rounded-full"
                style={{ border: "2px solid rgba(201,168,76,0.3)" }}
              >
                <img
                  src={agent.image}
                  alt={agent.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Name + stats — above the bottom button */}
            <div className="absolute inset-x-0 bottom-11 z-10 text-center">
              <p className="text-sm font-semibold text-white">{agent.name}</p>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--brand-gold)" }}
              >
                {agent.stats}
              </p>
            </div>

            {/* View profile — bottom right "+" button */}
            <Link
              href={`/agents/${agent.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 group-hover:border-[#c9a84c]/40"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-base font-light leading-none text-white/50 group-hover:text-[#c9a84c]">
                +
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Footer link */}
      <div className="mt-14 text-center">
        <Link
          href="/agents"
          className="text-sm font-medium text-[#1B1B1B]/50 transition-colors hover:text-[#c9a84c]"
        >
          Meet All Agents →
        </Link>
      </div>
    </section>
  );
}
