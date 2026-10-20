import { noindexMeta } from "@/lib/seo";

export const metadata = noindexMeta("Sign In");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
