"use client";

import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import { useScrollWordLight } from "@/hooks/useScrollWordLight";

type Props = {
  name: string;
  title: string | null;
  headshot: string | null;
  phone: string | null;
  onPhotoRef?: (el: HTMLDivElement | null) => void;
  photoHidden?: boolean;
};

export function AgentHeroSection({ name, title, headshot, phone, onPhotoRef, photoHidden = false }: Props) {
  const titleText = title ?? "Real Estate Agent";
  const nameWords = name.split(" ");

  // "Hey there! My name is" + name words (comma on last) + "a licensed" + title words + "with CnC Realty"
  const nameWordsTagged = nameWords.map((w, i) =>
    i === nameWords.length - 1 ? w + "," : w
  );
  const prefix = ["Hey", "there!", "My", "name", "is"];
  const suffix = ["a", "licensed", ...titleText.split(" "), "with", "CnC", "Realty"];
  const allWords = [...prefix, ...nameWordsTagged, ...suffix];

  const nameStart = prefix.length;
  const nameEnd = prefix.length + nameWords.length - 1; // inclusive

  const { sectionRef, litCount } = useScrollWordLight(allWords.length);

  return (
    <section
      ref={sectionRef}
      className="bg-cnc-bg px-6 pb-16 pt-28 md:px-12 md:pb-20 lg:px-20"
    >
      <div className="mx-auto max-w-5xl">
        {/* Circular headshot placeholder — hidden, holds layout space for morph animation */}
        <div className="mb-6 flex justify-center">
          <div
            ref={onPhotoRef}
            className="relative overflow-hidden rounded-full bg-[#E0DDD8]"
            style={{
              width: "clamp(3rem, 7.5vw, 6.5rem)",
              height: "clamp(3rem, 7.5vw, 6.5rem)",
              visibility: photoHidden ? "hidden" : "visible",
            }}
          >
            {headshot ? (
              <Image
                src={headshot}
                alt={name}
                fill
                sizes="104px"
                quality={95}
                className="object-cover object-top"
                priority
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-sans text-xl font-light text-[#1B1B1B]/30">
                {name[0]?.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <p className="break-words text-center font-sans text-[1.9rem] font-light leading-[1.25] sm:text-[2.4rem] lg:text-[3rem]">
          {allWords.map((word, i) => (
            <span
              key={i}
              className="transition-colors duration-300"
              style={{
                color:
                  i < litCount
                    ? i >= nameStart && i <= nameEnd
                      ? "#9E8C61"
                      : "#1B1B1B"
                    : "#C4BFB8",
                fontWeight: i >= nameStart && i <= nameEnd ? 500 : undefined,
              }}
            >
              {word}
              {i < allWords.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#contact"
            className="flex items-center gap-2 rounded-full bg-[#1B1B1B] px-5 py-2.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            <Mail size={14} />
            Send Email
          </a>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 rounded-full border border-[#1B1B1B]/25 px-5 py-2.5 font-sans text-sm text-[#1B1B1B]/70 transition-colors hover:border-[#1B1B1B]/50 hover:text-[#1B1B1B]"
            >
              <Phone size={14} />
              {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
