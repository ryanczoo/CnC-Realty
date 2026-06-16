"use client";

import { useState, useMemo } from "react";
import { BlogHero } from "./BlogHero";
import { BlogCard, type BlogPostSummary } from "./BlogCard";
import { SortFilter } from "./SortFilter";

export function NewsGrid({ posts }: { posts: BlogPostSummary[] }) {
  const [sort, setSort] = useState<"desc" | "asc">("desc");

  const sorted = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const da = new Date(a.publishedAt ?? a.id).getTime();
        const db = new Date(b.publishedAt ?? b.id).getTime();
        return sort === "desc" ? db - da : da - db;
      }),
    [posts, sort]
  );

  const [hero, ...rest] = sorted;

  if (!hero) {
    return (
      <p className="font-sans text-base text-[#1B1B1B]/40">No posts yet. Check back soon.</p>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      {/* Sort + hero */}
      <div className="flex flex-col gap-8">
        <div className="flex justify-end">
          <SortFilter sort={sort} onToggle={() => setSort((s) => (s === "desc" ? "asc" : "desc"))} />
        </div>
        <BlogHero post={hero} />
      </div>

      {/* Grid */}
      {rest.length > 0 && (
        <div className="border-t border-[#1B1B1B]/10 pt-12">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
