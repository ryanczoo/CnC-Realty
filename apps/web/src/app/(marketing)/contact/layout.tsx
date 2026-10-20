import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("/contact");

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
