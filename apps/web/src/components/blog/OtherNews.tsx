import { BlogCard, type BlogPostSummary } from "./BlogCard";

interface OtherNewsProps {
  posts: BlogPostSummary[];
}

export function OtherNews({ posts }: OtherNewsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-[#1B1B1B]/10 pt-16">
      <h2 className="mb-10 font-sans text-3xl font-light text-[#1B1B1B]">Other News</h2>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
