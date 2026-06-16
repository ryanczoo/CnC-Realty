interface PostBodyProps {
  html: string;
}

export function PostBody({ html }: PostBodyProps) {
  return (
    <div
      className="prose prose-neutral max-w-none prose-headings:font-sans prose-headings:font-light prose-headings:text-[#1B1B1B] prose-p:text-[#1B1B1B]/80 prose-p:leading-relaxed prose-a:text-[#9E8C61] prose-a:no-underline hover:prose-a:underline prose-strong:text-[#1B1B1B] prose-li:text-[#1B1B1B]/80 prose-img:rounded-2xl"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
