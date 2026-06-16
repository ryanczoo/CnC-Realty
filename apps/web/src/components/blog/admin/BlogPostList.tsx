"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  coverImage: string | null;
  authorName: string | null;
  author: { name: string | null } | null;
}

export function BlogPostList({ posts: initial }: { posts: PostRow[] }) {
  const [posts, setPosts] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/blog/${id}`, { method: "DELETE" });
      setPosts((p) => p.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10">
      <table className="w-full text-sm">
        <thead className="bg-[#F2F0EF] text-left text-xs uppercase tracking-wider text-[#1B1B1B]/50">
          <tr>
            <th className="px-4 py-3 w-12" />
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Author</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1B1B]/5 bg-white">
          {posts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[#1B1B1B]/40">
                No posts yet.{" "}
                <Link href="/admin/blog/new" className="text-[#9E8C61] hover:underline">
                  Create your first post →
                </Link>
              </td>
            </tr>
          )}
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-[#F2F0EF]/40">
              <td className="px-4 py-3">
                {post.coverImage && (
                  <div className="relative h-10 w-14 overflow-hidden rounded-lg">
                    <Image src={post.coverImage} alt="" fill className="object-cover" unoptimized />
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-[#1B1B1B] max-w-xs truncate">{post.title}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  post.published
                    ? "bg-green-100 text-green-700"
                    : "bg-[#F2F0EF] text-[#1B1B1B]/50"
                }`}>
                  {post.published ? "Published" : "Draft"}
                </span>
              </td>
              <td className="px-4 py-3 text-[#1B1B1B]/60">{post.authorName ?? post.author?.name ?? "—"}</td>
              <td className="px-4 py-3 text-[#1B1B1B]/60">
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/admin/blog/${post.id}/edit`}
                    className="font-sans text-xs text-[#1B1B1B]/50 hover:text-[#1B1B1B] transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className="font-sans text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    {deleting === post.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
