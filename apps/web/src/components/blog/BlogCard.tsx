"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { PULSE_ANIMATE, PULSE_TRANSITION } from "@/lib/motion";

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | Date | null;
  authorName: string | null;
  author: { name: string | null } | null;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={`/press/${post.slug}`} className="group flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl aspect-[16/9] bg-[#1B1B1B] relative">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1B1B1B]" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-sans text-sm text-[#9E8C61]">{formatDate(post.publishedAt)}</p>
        <h3 className="font-sans text-lg font-light text-[#1B1B1B] leading-snug line-clamp-2 group-hover:text-[#9E8C61] transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="font-sans text-sm text-[#1B1B1B]/60 line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <motion.div
          whileHover={{ scale: 1.05 }}
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          className="mt-1 self-start"
        >
          <span className="inline-flex items-center rounded-full bg-[#1B1B1B] px-4 py-2 font-sans text-xs font-medium text-white">
            Read More
          </span>
        </motion.div>
      </div>
    </Link>
  );
}
