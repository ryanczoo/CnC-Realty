"use client";

import { ReactNode } from "react";

const G = ({ children }: { children: ReactNode }) => (
  <span style={{ color: "#9E8C61" }}>{children}</span>
);

type Row = {
  label: string;
  body: ReactNode;
  img: string;
  imgSide: "left" | "right";
  bg: string;
  textBg: string;
  textColor: string;
};

const ROWS: Row[] = [
  {
    label: "Dare to Dream",
    body: <>Our cloud-based brokerage system is how we are able to provide <G>everything</G> you need, and <G>nothing</G> you don't. Become the master of your domain wherever and whenever you go by not being bound by an office area location.</>,
    img: "/images/join-agent.jpg",
    imgSide: "right",
    bg: "#F2F0EF",
    textBg: "#1B1B1B",
    textColor: "#FFFFFF",
  },
  {
    label: "Tools for Success",
    body: <>In this era of technology, you either utilize its potential to your advantage or get left behind. CnC has created a <G>fully-custom CRM</G> built by AI and real estate experts to provide lead tracking with automatic scoring, activity feed by potential clients, and a pipeline Kanban board <G>FREE</G> for agents. We also have an integrated transaction management software and email campaigns available for every CnC agent.</>,
    img: "/images/join-crm.png",
    imgSide: "left",
    bg: "#ECEAE7",
    textBg: "#FFFFFF",
    textColor: "#1B1B1B",
  },
  {
    label: "Beyond the Brand",
    body: <>CnC is more than just a name, its a <G>community</G> of like-minded professionals helping each other grow. Join a culture that makes you feel at home and always striving for <G>success</G>. Our mentorship program and network promotes communication versus isolation so you are never feeling alone.</>,
    img: "/images/join-community.jpg",
    imgSide: "right",
    bg: "#1B1B1B",
    textBg: "#1B1B1B",
    textColor: "#FFFFFF",
  },
];

export function WhyCnCStacked() {
  return (
    <section className="bg-cnc-bg">
      {/* heading above the stack */}
      <div className="px-8 pt-20 pb-10 text-right lg:px-24">
        <h2 className="font-sans font-light leading-[1.0] text-[#1B1B1B]">
          <span className="block text-[2.5rem] xl:text-[3rem]">For Agents,</span>
          <span className="block text-[3.5rem] xl:text-[4.2rem]">By <span className="text-[#9E8C61]">Agents</span></span>
        </h2>
      </div>

      <div className="relative" style={{ paddingBottom: "100px" }}>
        {ROWS.map((row, i) => (
          <div
            key={i}
            className="sticky bg-cnc-bg px-[24px]"
            style={{ top: `${80 + i * 88}px`, height: "52vh" }}
          >
            <div className="flex h-full overflow-hidden" style={{ backgroundColor: row.bg }}>
              {row.imgSide === "left" && (
                <div className="relative w-1/2 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.img} alt={row.label} className="absolute inset-0 h-full w-full object-cover" />
                </div>
              )}

              <div
                className="flex w-1/2 flex-col justify-between p-10 lg:p-16"
                style={{ backgroundColor: row.textBg }}
              >
                <h3
                  className="font-sans text-[2.5rem] font-semibold uppercase tracking-widest leading-tight"
                  style={{ color: row.textColor }}
                >
                  {row.label}
                </h3>
                <p
                  className="max-w-lg font-sans text-[1.25rem] font-light leading-relaxed"
                  style={{ color: row.textColor }}
                >
                  {row.body}
                </p>
              </div>

              {row.imgSide === "right" && (
                <div className="relative w-1/2 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.img} alt={row.label} className="absolute inset-0 h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
