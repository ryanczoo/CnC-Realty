import { noindexMeta } from "@/lib/seo";

export const metadata = noindexMeta("Create Account");

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
