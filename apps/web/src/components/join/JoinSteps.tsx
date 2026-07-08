"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useScroll } from "motion/react";
import Image from "next/image";
import { useScrollStepper } from "@/hooks/useScrollStepper";
import { RevealLine } from "@/components/ui/reveal-text";

function IconTransactionManagement() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12L5 12M22 12L19 12M14 12L10 12" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5 13L5 7.5C5 6.56538 5 6.09808 5.20096 5.75C5.33261 5.52197 5.52197 5.33261 5.75 5.20096C6.09808 5 6.56538 5 7.5 5C8.43462 5 8.90192 5 9.25 5.20096C9.47803 5.33261 9.66739 5.52197 9.79904 5.75C10 6.09808 10 6.56538 10 7.5L10 16.5C10 17.4346 10 17.9019 9.79904 18.25C9.66739 18.478 9.47803 18.6674 9.25 18.799C8.90192 19 8.43462 19 7.5 19C6.56538 19 6.09808 19 5.75 18.799C5.52197 18.6674 5.33261 18.478 5.20096 18.25C5.03954 17.9704 5.00778 17.6139 5.00153 17" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16.5 7C15.5654 7 15.0981 7 14.75 7.20096C14.522 7.33261 14.3326 7.52197 14.201 7.75C14 8.09808 14 8.56538 14 9.5L14 14.5C14 15.4346 14 15.9019 14.201 16.25C14.3326 16.478 14.522 16.6674 14.75 16.799C15.0981 17 15.5654 17 16.5 17C17.4346 17 17.9019 17 18.25 16.799C18.478 16.6674 18.6674 16.478 18.799 16.25C19 15.9019 19 15.4346 19 14.5V9.5C19 8.56538 19 8.09808 18.799 7.75C18.6674 7.52197 18.478 7.33261 18.25 7.20096C17.9019 7 17.4346 7 16.5 7Z" stroke="#9E8C61" strokeWidth="1.5"/>
    </svg>
  );
}

function IconCRMSoftware() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 13H16C17.7107 13 19.1506 14.2804 19.3505 15.9795L20 21.5M8 13C5.2421 12.3871 3.06717 10.2687 2.38197 7.52787L2 6M8 13V18C8 19.8856 8 20.8284 8.58579 21.4142C9.17157 22 10.1144 22 12 22C13.8856 22 14.8284 22 15.4142 21.4142C16 20.8284 16 19.8856 16 18V17" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="6" r="4" stroke="#9E8C61" strokeWidth="1.5"/>
    </svg>
  );
}

function IconPersonalWebpage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 17H8C5.17157 17 3.75736 17 2.87868 16.1213C2 15.2426 2 13.8284 2 11V10C2 6.22876 2 4.34315 3.17157 3.17157C3.64118 2.70197 4.2255 2.4206 5 2.25201M22 8.5C22 6.16537 22 4.99805 21.5277 4.11441C21.1548 3.4167 20.5833 2.84525 19.8856 2.47231C19.0019 2 17.8346 2 15.5 2H10C9.65081 2 9.31779 2 9 2.00093" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 15C14 13.1144 14 12.1716 14.5858 11.5858C15.1716 11 16.1144 11 18 11C19.8856 11 20.8284 11 21.4142 11.5858C22 12.1716 22 13.1144 22 15V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V15Z" stroke="#9E8C61" strokeWidth="1.5"/>
      <path d="M19 20H17" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 22V22.75C11.4142 22.75 11.75 22.4142 11.75 22H11ZM8 21.25C7.58579 21.25 7.25 21.5858 7.25 22C7.25 22.4142 7.58579 22.75 8 22.75V21.25ZM11.75 17C11.75 16.5858 11.4142 16.25 11 16.25C10.5858 16.25 10.25 16.5858 10.25 17H11.75ZM11 21.25H8V22.75H11V21.25ZM11.75 22V17H10.25V22H11.75Z" fill="#9E8C61"/>
      <path d="M11 13H2" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconEmailCampaigns() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 13H5.16026C6.06543 13 6.51802 13 6.91584 13.183C7.31367 13.3659 7.60821 13.7096 8.19729 14.3968L8.80271 15.1032C9.39179 15.7904 9.68633 16.1341 10.0842 16.317C10.482 16.5 10.9346 16.5 11.8397 16.5H12.1603C13.0654 16.5 13.518 16.5 13.9158 16.317C14.3137 16.1341 14.6082 15.7904 15.1973 15.1032L15.8027 14.3968C16.3918 13.7096 16.6863 13.3659 17.0842 13.183C17.482 13 17.9346 13 18.8397 13H22" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C21.5093 4.43821 21.8356 5.80655 21.9449 8" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconInteractiveTaskBoard() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.5 14L17 14" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 14H7.5" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 10.5H7.5" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 17.5H7.5" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10.5 10.5H17" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10.5 17.5H17" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 3.5C8 2.67157 8.67157 2 9.5 2H14.5C15.3284 2 16 2.67157 16 3.5V4.5C16 5.32843 15.3284 6 14.5 6H9.5C8.67157 6 8 5.32843 8 4.5V3.5Z" stroke="#9E8C61" strokeWidth="1.5"/>
      <path d="M21 16.0002C21 18.8286 21 20.2429 20.1213 21.1215C19.2426 22.0002 17.8284 22.0002 15 22.0002H9C6.17157 22.0002 4.75736 22.0002 3.87868 21.1215C3 20.2429 3 18.8286 3 16.0002V13.0002M16 4.00195C18.175 4.01406 19.3529 4.11051 20.1213 4.87889C21 5.75757 21 7.17179 21 10.0002V12.0002M8 4.00195C5.82497 4.01406 4.64706 4.11051 3.87868 4.87889C3.11032 5.64725 3.01385 6.82511 3.00174 9" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const STEPS = [
  {
    title: { first: "Transaction", mid: "", last: "Management" },
    titleBreak: true,
    body: "Manage all of your listings and transactions in one place with our full transaction management system built exclusively for CnC agents",
    img: "/images/join-slide-transaction.png",
    imgPosition: "top",
    icon: IconTransactionManagement,
  },
  {
    title: { first: "CRM", mid: "", last: "Software" },
    titleBreak: true,
    body: "Track every lead with a full pipeline, smart lists, and deal management tools built right into\nyour CnC dashboard",
    img: "/images/join-slide-crm.png",
    imgPosition: "top",
    icon: IconCRMSoftware,
  },
  {
    title: { first: "Personal", mid: "", last: "Webpage" },
    titleBreak: true,
    body: "Your own professional website complete with stats, contact info, and a bio created the moment you join",
    img: "/images/join-slide-agent.png",
    imgPosition: "top",
    icon: IconPersonalWebpage,
  },
  {
    title: { first: "Email", mid: "", last: "Campaigns" },
    titleBreak: true,
    body: "Send branded emails, setup DRIP campaigns, and follow-up with clients directly\nwithin CnC's dashboard",
    img: "/images/join-slide-campaign.png",
    imgPosition: "top",
    icon: IconEmailCampaigns,
  },
  {
    title: { first: "Interactive", mid: "", last: "Task Board" },
    titleBreak: true,
    body: "Control all of your leads easily with a drag-and-drop task board, giving you the ability to move deals from new to closed with ease",
    img: "/images/join-slide-kanban.png",
    imgPosition: "top",
    icon: IconInteractiveTaskBoard,
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
            <div className="ml-auto"><active.icon /></div>
            <p className="ml-auto max-w-sm whitespace-pre-line font-sans text-[1.1rem] leading-relaxed text-[#1B1B1B]/60">
              {active.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
