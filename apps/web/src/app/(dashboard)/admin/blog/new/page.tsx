import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BlogEditorForm } from "@/components/blog/admin/BlogEditorForm";

export const metadata = { title: "New Post | CnC Realty Admin" };

export default async function NewBlogPostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { name?: string | null; role: string };
  const isAdmin = user.role === "ADMIN";
  const defaultAuthorName = user.name ?? "CnC Realty";

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/blog" className="font-sans text-sm text-[#1B1B1B]/40 hover:text-[#1B1B1B] transition-colors">
          ← All Posts
        </Link>
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">New Post</h1>
      </div>
      <BlogEditorForm isAdmin={isAdmin} defaultAuthorName={defaultAuthorName} />
    </div>
  );
}
