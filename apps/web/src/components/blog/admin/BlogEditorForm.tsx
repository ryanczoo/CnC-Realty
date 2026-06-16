"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2 } from "lucide-react";
import Image from "next/image";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorName: string | null;
  published: boolean;
}

interface BlogEditorFormProps {
  post?: Post;
  isAdmin: boolean;
  defaultAuthorName: string;
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BlogEditorForm({ post, isAdmin, defaultAuthorName }: BlogEditorFormProps) {
  const router = useRouter();
  const isNew = !post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [authorName, setAuthorName] = useState(post?.authorName ?? defaultAuthorName);
  const [published, setPublished] = useState(post?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const postIdRef = useRef<string | null>(post?.id ?? null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your post content here..." }),
      Link.configure({ openOnClick: false }),
    ],
    content: post?.content ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[400px] p-4 outline-none font-sans text-sm text-[#1B1B1B] leading-relaxed prose prose-neutral max-w-none",
      },
    },
  });

  // Auto-generate slug from title (until manually edited)
  useEffect(() => {
    if (!slugManual && title) setSlug(toSlug(title));
  }, [title, slugManual]);

  const getPayload = useCallback(() => ({
    title,
    slug,
    excerpt,
    content: editor?.getHTML() ?? "",
    coverImage,
    authorName,
  }), [title, slug, excerpt, editor, coverImage, authorName]);

  const saveDraft = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isNew && !postIdRef.current) {
        // First save — create the post
        const res = await fetch("/api/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getPayload()),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = await res.json();
        postIdRef.current = created.id;
        // Update URL without reload so auto-save has an ID from now on
        window.history.replaceState({}, "", `/admin/blog/${created.id}/edit`);
      } else if (postIdRef.current) {
        const res = await fetch(`/api/blog/${postIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getPayload()),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err) {
      console.error(err);
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }, [isNew, getPayload]);

  // Schedule auto-save 30s after any change (only if post already has an ID)
  useEffect(() => {
    if (isNew && !postIdRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(saveDraft, 30_000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, slug, excerpt, coverImage, authorName, isNew, saveDraft]);

  const handlePublish = async () => {
    await saveDraft();
    if (!postIdRef.current) return;
    setSaving(true);
    try {
      await fetch(`/api/blog/${postIdRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      setPublished(true);
      setSaveMsg("Published!");
      setTimeout(() => setSaveMsg(""), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!postIdRef.current) return;
    setSaving(true);
    try {
      await fetch(`/api/blog/${postIdRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      setPublished(false);
      setSaveMsg("Unpublished");
      setTimeout(() => setSaveMsg(""), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const toolBtn = (active: boolean) =>
    `rounded px-2 py-1 text-xs transition-colors ${
      active ? "bg-[#1B1B1B] text-white" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
    }`;

  return (
    <div className="flex flex-col gap-8">

      {/* Title */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-lg text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
          placeholder="post-url-slug"
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
        <p className="mt-1 font-sans text-xs text-[#1B1B1B]/40">cncrealtygroup.com/news/{slug || "..."}</p>
      </div>

      {/* Excerpt */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Excerpt</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          placeholder="Short summary shown on the news index page and in search results"
          className="w-full resize-none rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
      </div>

      {/* Cover Image URL */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Cover Image URL</label>
        <input
          type="url"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="https://images.pexels.com/..."
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
        {coverImage && (
          <div className="mt-3 relative h-40 w-full overflow-hidden rounded-xl">
            <Image src={coverImage} alt="Cover preview" fill className="object-cover" unoptimized />
          </div>
        )}
      </div>

      {/* Author Name */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Author Name</label>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="e.g. Ryan Chong or CnC Realty AI"
          className="w-full rounded-xl border border-[#1B1B1B]/10 bg-white px-4 py-3 font-sans text-sm text-[#1B1B1B] outline-none placeholder:text-[#1B1B1B]/30 focus:border-[#1B1B1B]/30"
        />
      </div>

      {/* Body — Tiptap */}
      <div>
        <label className="mb-1.5 block font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">Body</label>
        <div className="overflow-hidden rounded-xl border border-[#1B1B1B]/10 bg-white">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-[#1B1B1B]/10 px-3 py-2">
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={toolBtn(editor?.isActive("heading", { level: 2 }) ?? false)}><Heading2 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={toolBtn(editor?.isActive("heading", { level: 3 }) ?? false)}><Heading3 className="h-3.5 w-3.5" /></button>
            <div className="mx-1 h-4 w-px bg-[#1B1B1B]/10" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={toolBtn(editor?.isActive("bold") ?? false)}><Bold className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={toolBtn(editor?.isActive("italic") ?? false)}><Italic className="h-3.5 w-3.5" /></button>
            <div className="mx-1 h-4 w-px bg-[#1B1B1B]/10" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={toolBtn(editor?.isActive("bulletList") ?? false)}><List className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={toolBtn(editor?.isActive("orderedList") ?? false)}><ListOrdered className="h-3.5 w-3.5" /></button>
            <div className="mx-1 h-4 w-px bg-[#1B1B1B]/10" />
            <button
              type="button"
              onClick={() => {
                const url = window.prompt("URL:");
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
              className={toolBtn(editor?.isActive("link") ?? false)}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#1B1B1B]/10 pt-6">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving}
          className="rounded-full bg-[#F2F0EF] px-6 py-2.5 font-sans text-sm font-medium text-[#1B1B1B] transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>

        {isAdmin && !published && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="rounded-full bg-[#1B1B1B] px-6 py-2.5 font-sans text-sm font-medium text-white transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Publish
          </button>
        )}

        {isAdmin && published && (
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={saving}
            className="rounded-full border border-[#1B1B1B]/20 px-6 py-2.5 font-sans text-sm font-medium text-[#1B1B1B]/60 transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Unpublish
          </button>
        )}

        {!isAdmin && (
          <span className="rounded-full border border-[#1B1B1B]/10 px-4 py-2 font-sans text-xs text-[#1B1B1B]/40">
            Pending Review — Admin publishes
          </span>
        )}

        {saveMsg && (
          <span className="font-sans text-sm text-[#9E8C61]">{saveMsg}</span>
        )}
      </div>
    </div>
  );
}
