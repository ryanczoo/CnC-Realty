import { noindexMeta } from "@/lib/seo";

export const metadata = noindexMeta("Reset Password");

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
