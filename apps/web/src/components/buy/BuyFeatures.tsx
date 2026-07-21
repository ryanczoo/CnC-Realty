"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { RevealLine } from "@/components/ui/reveal-text";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

const MotionLink = motion(Link);

function IconPerson() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 13H16C17.7107 13 19.1506 14.2804 19.3505 15.9795L20 21.5M8 13C5.2421 12.3871 3.06717 10.2687 2.38197 7.52787L2 6M8 13V18C8 19.8856 8 20.8284 8.58579 21.4142C9.17157 22 10.1144 22 12 22C13.8856 22 14.8284 22 15.4142 21.4142C16 20.8284 16 19.8856 16 18V17" stroke="#1B1B1B" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="6" r="4" stroke="#1B1B1B" strokeWidth="1.5"/>
    </svg>
  );
}

function IconThumbsUp() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 22V11M2 13V20C2 21.1046 2.89543 22 4 22H17.4262C18.3991 22 19.2235 21.3265 19.4036 20.3704L20.8036 12.3704C21.0306 11.1394 20.1028 10 18.8262 10H14V6C14 4.89543 13.1046 4 12 4L9 11H7" stroke="#1B1B1B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconAward() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 16V19" stroke="#1B1B1B" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15.5 22H8.5L8.83922 20.3039C8.93271 19.8365 9.34312 19.5 9.8198 19.5H14.1802C14.6569 19.5 15.0673 19.8365 15.1608 20.3039L15.5 22Z" stroke="#1B1B1B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 5L19.9486 5.31621C20.9387 5.64623 21.4337 5.81124 21.7168 6.20408C22 6.59692 22 7.11873 21.9999 8.16234L21.9999 8.23487C21.9999 9.09561 21.9999 9.52598 21.7927 9.87809C21.5855 10.2302 21.2093 10.4392 20.4569 10.8572L17.5 12.5" stroke="#1B1B1B" strokeWidth="1.5"/>
      <path d="M4.99994 5L4.05132 5.31621C3.06126 5.64623 2.56623 5.81124 2.2831 6.20408C1.99996 6.59692 1.99997 7.11873 2 8.16234L2 8.23487C2.00003 9.09561 2.00004 9.52598 2.20723 9.87809C2.41441 10.2302 2.79063 10.4392 3.54305 10.8572L6.49994 12.5" stroke="#1B1B1B" strokeWidth="1.5"/>
      <path d="M11.1459 6.02251C11.5259 5.34084 11.7159 5 12 5C12.2841 5 12.4741 5.34084 12.8541 6.02251L12.9524 6.19887C13.0603 6.39258 13.1143 6.48944 13.1985 6.55334C13.2827 6.61725 13.3875 6.64097 13.5972 6.68841L13.7881 6.73161C14.526 6.89857 14.895 6.98205 14.9828 7.26432C15.0706 7.54659 14.819 7.84072 14.316 8.42898L14.1858 8.58117C14.0429 8.74833 13.9714 8.83191 13.9392 8.93531C13.9071 9.03872 13.9179 9.15023 13.9395 9.37327L13.9592 9.57632C14.0352 10.3612 14.0733 10.7536 13.8435 10.9281C13.6136 11.1025 13.2682 10.9435 12.5773 10.6254L12.3986 10.5431C12.2022 10.4527 12.1041 10.4075 12 10.4075C11.8959 10.4075 11.7978 10.4527 11.6014 10.5431L11.4227 10.6254C10.7318 10.9435 10.3864 11.1025 10.1565 10.9281C9.92674 10.7536 9.96476 10.3612 10.0408 9.57632L10.0605 9.37327C10.0821 9.15023 10.0929 9.03872 10.0608 8.93531C10.0286 8.83191 9.95713 8.74833 9.81418 8.58117L9.68403 8.42898C9.18097 7.84072 8.92945 7.54659 9.01723 7.26432C9.10501 6.98205 9.47396 6.89857 10.2119 6.73161L10.4028 6.68841C10.6125 6.64097 10.7173 6.61725 10.8015 6.55334C10.8857 6.48944 10.9397 6.39258 11.0476 6.19887L11.1459 6.02251Z" stroke="#1B1B1B" strokeWidth="1.5"/>
      <path d="M18 22H6" stroke="#1B1B1B" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17 2.45597C17.7415 2.59747 18.1811 2.75299 18.5609 3.22083C19.0367 3.80673 19.0115 4.43998 18.9612 5.70647C18.7805 10.2595 17.7601 16 12.0002 16C6.24021 16 5.21983 10.2595 5.03907 5.70647C4.98879 4.43998 4.96365 3.80673 5.43937 3.22083C5.91508 2.63494 6.48445 2.53887 7.62318 2.34674C8.74724 2.15709 10.2166 2 12.0002 2C12.7184 2 13.3857 2.02548 14 2.06829" stroke="#1B1B1B" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const FEATURES = [
  { text: "Local agents on standby", icon: IconPerson },
  { text: "Award-winning lenders for instant approval", icon: IconThumbsUp },
  { text: "Certified escrow officers to close with confidence", icon: IconAward },
];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: "easeOut", delay } as const,
});

export function BuyFeatures() {
  return (
    <section className="bg-[#F2F0EF] px-8 py-20 lg:px-20">
      <div className="mx-auto max-w-6xl">
        {/* Staggered title — centered as a block, "SHOP" indented under "stop" */}
        <div className="mb-16 flex justify-center">
          <h2 className="font-sans font-light leading-[1.05]">
            <span className="block text-[2.4rem] xl:text-[2.9rem] text-[#1B1B1B]">
              <RevealLine delay={0}>One stop</RevealLine>
            </span>
            <span className="block text-[3.2rem] xl:text-[3.8rem] ml-[5rem] xl:ml-[6rem]">
              <RevealLine delay={0.15}>
                <span className="text-cnc-gold font-medium">SHOP</span>
              </RevealLine>
            </span>
          </h2>
        </div>

        {/* 4-column row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={i}
              {...fadeUp(i * 0.1)}
              className="flex flex-col gap-4 border-l border-[#1B1B1B]/15 px-8 py-6"
            >
              <feature.icon />
              <p className="font-sans text-[0.95rem] font-light leading-relaxed text-[#1B1B1B]/80">
                {feature.text}
              </p>
            </motion.div>
          ))}

          {/* CTA column */}
          <motion.div
            {...fadeUp(0.3)}
            className="flex flex-col justify-end border-l border-[#1B1B1B]/15 px-8 pt-6 pb-2"
          >
            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">
                Explore
              </span>
              <MotionLink
                href="/properties"
                animate={PULSE_ANIMATE}
                whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
                transition={PULSE_TRANSITION}
                className="inline-flex w-fit items-center rounded-full bg-[#1B1B1B] px-6 py-3 font-sans text-sm font-medium text-white"
              >
                All Listings
              </MotionLink>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
