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
      <path d="M14 4C14 5.10457 13.1046 6 12 6C10.8954 6 10 5.10457 10 4C10 2.89543 10.8954 2 12 2C13.1046 2 14 2.89543 14 4Z" stroke="#9E8C61" strokeWidth="1.5"/>
      <path d="M6.04779 10.849L6.28497 10.1375H6.28497L6.04779 10.849ZM8.22309 11.5741L7.98592 12.2856H7.98592L8.22309 11.5741ZM9.01682 13.256L8.31681 12.9868H8.31681L9.01682 13.256ZM7.77003 16.4977L8.47004 16.7669H8.47004L7.77003 16.4977ZM17.9522 10.849L17.715 10.1375H17.715L17.9522 10.849ZM15.7769 11.5741L16.0141 12.2856H16.0141L15.7769 11.5741ZM14.9832 13.256L15.6832 12.9868L14.9832 13.256ZM16.23 16.4977L15.53 16.7669L16.23 16.4977ZM10.4242 17.7574L11.0754 18.1295L10.4242 17.7574ZM12 14.9997L12.6512 14.6276C12.5177 14.394 12.2691 14.2497 12 14.2497C11.7309 14.2497 11.4823 14.394 11.3488 14.6276L12 14.9997ZM17.1465 7.8969L16.9894 7.16355L17.1465 7.8969ZM15.249 8.30353L15.4061 9.03688V9.03688L15.249 8.30353ZM8.75102 8.30353L8.90817 7.57018V7.57018L8.75102 8.30353ZM6.85345 7.89691L6.69631 8.63026L6.85345 7.89691ZM13.5758 17.7574L12.9246 18.1295V18.1295L13.5758 17.7574ZM15.0384 8.34826L14.8865 7.61381L14.8865 7.61381L15.0384 8.34826ZM8.96161 8.34826L8.80969 9.08272L8.80969 9.08272L8.96161 8.34826ZM15.2837 11.7666L15.6777 12.4048L15.2837 11.7666ZM14.8182 12.753L15.5613 12.6514V12.6514L14.8182 12.753ZM8.71625 11.7666L8.3223 12.4048H8.3223L8.71625 11.7666ZM9.18177 12.753L9.92485 12.8546V12.8546L9.18177 12.753ZM10.3454 9.32206C10.7573 9.36558 11.1265 9.06692 11.17 8.655C11.2135 8.24308 10.9149 7.87388 10.503 7.83036L10.3454 9.32206ZM13.497 7.83036C13.0851 7.87388 12.7865 8.24308 12.83 8.655C12.8735 9.06692 13.2427 9.36558 13.6546 9.32206L13.497 7.83036ZM5.81062 11.5605L7.98592 12.2856L8.46026 10.8626L6.28497 10.1375L5.81062 11.5605ZM8.31681 12.9868L7.07002 16.2284L8.47004 16.7669L9.71683 13.5252L8.31681 12.9868ZM17.715 10.1375L15.5397 10.8626L16.0141 12.2856L18.1894 11.5605L17.715 10.1375ZM14.2832 13.5252L15.53 16.7669L16.93 16.2284L15.6832 12.9868L14.2832 13.5252ZM11.0754 18.1295L12.6512 15.3718L11.3488 14.6276L9.77299 17.3853L11.0754 18.1295ZM16.9894 7.16355L15.0918 7.57017L15.4061 9.03688L17.3037 8.63026L16.9894 7.16355ZM8.90817 7.57018L7.0106 7.16355L6.69631 8.63026L8.59387 9.03688L8.90817 7.57018ZM11.3488 15.3718L12.9246 18.1295L14.227 17.3853L12.6512 14.6276L11.3488 15.3718ZM15.0918 7.57017C14.9853 7.593 14.9356 7.60366 14.8865 7.61381L15.1903 9.08272C15.2458 9.07123 15.3016 9.05928 15.4061 9.03688L15.0918 7.57017ZM8.59387 9.03688C8.6984 9.05928 8.75416 9.07123 8.80969 9.08272L9.11353 7.61381C9.06443 7.60366 9.01468 7.593 8.90817 7.57018L8.59387 9.03688ZM9.14506 19.2497C9.94287 19.2497 10.6795 18.8222 11.0754 18.1295L9.77299 17.3853C9.64422 17.6107 9.40459 17.7497 9.14506 17.7497V19.2497ZM15.53 16.7669C15.7122 17.2406 15.3625 17.7497 14.8549 17.7497V19.2497C16.4152 19.2497 17.4901 17.6846 16.93 16.2284L15.53 16.7669ZM15.5397 10.8626C15.3178 10.9366 15.0816 11.01 14.8898 11.1283L15.6777 12.4048C15.6688 12.4102 15.6763 12.4037 15.7342 12.3818C15.795 12.3588 15.877 12.3313 16.0141 12.2856L15.5397 10.8626ZM15.6832 12.9868C15.6313 12.8519 15.6004 12.7711 15.5795 12.7095C15.5596 12.651 15.5599 12.6411 15.5613 12.6514L14.0751 12.8546C14.1057 13.0779 14.1992 13.3069 14.2832 13.5252L15.6832 12.9868ZM14.8898 11.1283C14.3007 11.492 13.9814 12.1687 14.0751 12.8546L15.5613 12.6514C15.5479 12.5534 15.5935 12.4567 15.6777 12.4048L14.8898 11.1283ZM18.25 9.39526C18.25 9.73202 18.0345 10.031 17.715 10.1375L18.1894 11.5605C19.1214 11.2499 19.75 10.3777 19.75 9.39526H18.25ZM7.07002 16.2284C6.50994 17.6846 7.58484 19.2497 9.14506 19.2497V17.7497C8.63751 17.7497 8.28784 17.2406 8.47004 16.7669L7.07002 16.2284ZM7.98592 12.2856C8.12301 12.3313 8.20501 12.3588 8.26583 12.3818C8.32371 12.4037 8.33115 12.4102 8.3223 12.4048L9.1102 11.1283C8.91842 11.01 8.68219 10.9366 8.46026 10.8626L7.98592 12.2856ZM9.71683 13.5252C9.80081 13.3069 9.89432 13.0779 9.92485 12.8546L8.43868 12.6514C8.44009 12.6411 8.4404 12.6509 8.42051 12.7095C8.3996 12.7711 8.36869 12.8519 8.31681 12.9868L9.71683 13.5252ZM8.3223 12.4048C8.40646 12.4567 8.45208 12.5534 8.43868 12.6514L9.92485 12.8546C10.0186 12.1687 9.69929 11.492 9.1102 11.1283L8.3223 12.4048ZM4.25 9.39526C4.25 10.3777 4.87863 11.2499 5.81062 11.5605L6.28497 10.1375C5.96549 10.031 5.75 9.73202 5.75 9.39526H4.25ZM5.75 9.39526C5.75 8.89717 6.20927 8.52589 6.69631 8.63026L7.0106 7.16355C5.58979 6.8591 4.25 7.9422 4.25 9.39526H5.75ZM12.9246 18.1295C13.3205 18.8222 14.0571 19.2497 14.8549 19.2497V17.7497C14.5954 17.7497 14.3558 17.6107 14.227 17.3853L12.9246 18.1295ZM19.75 9.39526C19.75 7.9422 18.4102 6.85909 16.9894 7.16355L17.3037 8.63026C17.7907 8.52589 18.25 8.89717 18.25 9.39526H19.75ZM10.503 7.83036C10.0374 7.78118 9.57371 7.709 9.11353 7.61381L8.80969 9.08272C9.31831 9.18792 9.83084 9.2677 10.3454 9.32206L10.503 7.83036ZM14.8865 7.61381C14.4263 7.709 13.9626 7.78118 13.497 7.83036L13.6546 9.32206C14.1692 9.2677 14.6817 9.18792 15.1903 9.08272L14.8865 7.61381Z" fill="#9E8C61"/>
      <path d="M19.4537 15C21.0372 15.7961 22 16.8475 22 18C22 18.7484 21.594 19.4541 20.8758 20.0749M4.54631 15C2.96285 15.7961 2 16.8475 2 18C2 20.4853 6.47715 22.5 12 22.5C13.8214 22.5 15.5291 22.2809 17 21.898" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconPersonalWebpage() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 2.25201C4.2255 2.4206 3.64118 2.70197 3.17157 3.17157C2 4.34315 2 6.22876 2 10V11C2 13.8284 2 15.2426 2.87868 16.1213C3.75736 17 5.17157 17 8 17H16C18.8284 17 20.2426 17 21.1213 16.1213C22 15.2426 22 13.8284 22 11V10C22 6.22876 22 4.34315 20.8284 3.17157C19.6569 2 17.7712 2 14 2H10C9.65081 2 9.31779 2 9 2.00093" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 22H8" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 17L12 22" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M22 13H16M2 13H12" stroke="#9E8C61" strokeWidth="1.5" strokeLinecap="round"/>
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
