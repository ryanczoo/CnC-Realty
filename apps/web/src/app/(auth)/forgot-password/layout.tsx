import { noindexMeta } from "@/lib/seo";

export const metadata = noindexMeta("Forgot Password");

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
