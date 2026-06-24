"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useScroll } from "motion/react";
import Image from "next/image";
import { useScrollStepper } from "@/hooks/useScrollStepper";
import { RevealLine } from "@/components/ui/reveal-text";

const STEPS = [
  {
    title: { first: "Transaction", mid: "", last: "Management" },
    titleBreak: true,
    body: "Manage all of your listings and transactions in one place with our full transaction management system built exclusively for CnC agents",
    img: "/images/join-slide-transaction.png",
    imgPosition: "top",
  },
  {
    title: { first: "CRM", mid: "", last: "Software" },
    titleBreak: true,
    body: "Track every lead with a full pipeline, smart lists, and deal management tools built right into\nyour CnC dashboard",
    img: "/images/join-slide-crm.png",
    imgPosition: "top",
  },
  {
    title: { first: "Personal", mid: "", last: "Webpage" },
    titleBreak: true,
    body: "Your own professional website complete with stats, contact info, and a bio created the moment you join",
    img: "/images/join-slide-agent.png",
    imgPosition: "top",
  },
  {
    title: { first: "Email", mid: "", last: "Campaigns" },
    titleBreak: true,
    body: "Send branded emails, setup DRIP campaigns, and follow-up with clients directly\nwithin CnC's dashboard",
    img: "/images/join-slide-campaign.png",
    imgPosition: "top",
  },
  {
    title: { first: "Interactive", mid: "", last: "Task Board" },
    titleBreak: true,
    body: "Control all of your leads easily with a drag-and-drop task board, giving you the ability to move deals from new to closed with ease",
    img: "/images/join-slide-kanban.png",
    imgPosition: "top",
  },
];

export function JoinSteps() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const { activeIdx, registerBarEl } = useScrollStepper(scrollYProgress, STEPS.length);
  const active = STEPS[activeIdx];

  return (
    <section ref={sectionRef} data-navbar-theme="light" className="relative flex bg-white pl-8 pr-20">

      {/* ── Left panel — scrolling images ── */}
      <div className="flex flex-1 flex-col gap-[4.2rem] py-[7.5vh]">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl"
            style={{ height: "49vh" }}
          >
            <Image
              src={step.img}
              alt={step.title.first + " " + step.title.last}
              fill
              className="object-cover"
              style={{ objectPosition: step.imgPosition }}
              sizes="(max-width: 1024px) 100vw, 55vw"
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

      {/* ── Progress bar — between panels ── */}
      <div className="sticky top-[100px] flex h-[68vh] w-8 flex-col items-end self-start py-10">
        <div className="flex h-full w-[2px] flex-col gap-[3px]">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="flex-1 overflow-hidden"
              style={{ backgroundColor: "rgba(27,27,27,0.12)" }}
            >
              <div
                ref={(el) => registerBarEl(i, el)}
                className="w-full bg-[#1B1B1B]"
                style={{ height: "0%", transition: "height 0.05s linear" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — sticky text ── */}
      <div className="sticky top-[100px] flex h-[68vh] w-[42%] flex-col justify-between self-start pb-12 pt-10 text-right">

        {/* TOP — step heading */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={`title-${activeIdx}`}
            className="font-sans text-[3.2rem] font-light leading-[1.0] xl:text-[3.8rem]"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.55, ease: "easeOut" } }}
            exit={{ opacity: 0, y: -30, transition: { duration: 0.35, ease: "easeIn" } }}
          >
            <RevealLine triggerOnMount>
              <span className="text-[2.4rem] xl:text-[2.9rem]">{active.title.first}{active.title.mid && ` ${active.title.mid}`} </span>
              {active.titleBreak && <br />}
              <span className="text-cnc-gold font-medium">{active.title.last}</span>
            </RevealLine>
          </motion.h2>
        </AnimatePresence>

        {/* BOTTOM — counter then body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`body-${activeIdx}`}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.35, ease: "easeIn" } }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-auto">
              <path d="M20.94,11A8.26,8.26,0,0,1,21,12a9,9,0,1,1-9-9,8.83,8.83,0,0,1,4,1" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="21 5 12 14 8 10" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="ml-auto max-w-sm whitespace-pre-line font-sans text-[1.1rem] leading-relaxed text-[#1B1B1B]/60">
              {active.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
