import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta("/home-value");

export default function HomeValueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
