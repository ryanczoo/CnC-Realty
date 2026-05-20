"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your email body here..." }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[200px] p-3 outline-none font-sans text-sm text-[#1B1B1B] leading-relaxed",
      },
    },
  });

  const btn = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-[#1B1B1B] text-white"
        : "bg-[#F2F0EF] text-[#1B1B1B]/60 hover:text-[#1B1B1B]"
    }`;

  return (
    <div className="rounded-xl border border-[#1B1B1B]/10 bg-white overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-[#1B1B1B]/10 px-3 py-2">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={btn(editor?.isActive("bold") ?? false)}
          aria-label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={btn(editor?.isActive("italic") ?? false)}
          aria-label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={btn(editor?.isActive("bulletList") ?? false)}
          aria-label="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={btn(editor?.isActive("orderedList") ?? false)}
          aria-label="Ordered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
