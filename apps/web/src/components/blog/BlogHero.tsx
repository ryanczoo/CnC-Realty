"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { SPRING_HOVER, PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";
import type { BlogPostSummary } from "./BlogCard";

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogHero({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/news/${post.slug}`} className="group flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {/* Cover image */}
      <div className="relative w-full overflow-hidden rounded-2xl aspect-[16/9] bg-[#1B1B1B] lg:w-[58%] flex-shrink-0">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            priority
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1B1B1B]" />
        )}
      </div>

      {/* Text panel */}
      <div className="flex flex-col gap-5 flex-1">
        <p className="font-sans text-sm tracking-widest uppercase text-[#9E8C61]">
          {formatDate(post.publishedAt)}
        </p>
        <h2 className="font-sans text-[2rem] font-light text-[#1B1B1B] leading-snug group-hover:text-[#9E8C61] transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="font-sans text-base text-[#1B1B1B]/60 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <motion.div
          whileHover={{ scale: 1.05 }}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          className="self-start"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[#1B1B1B] px-6 py-3 font-sans text-sm font-medium text-white">
            Read More →
          </span>
        </motion.div>
      </div>
    </Link>
  );
}
