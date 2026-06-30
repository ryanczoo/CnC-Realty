import type { Metadata } from "next";
import { ApplicationForm } from "@/components/join/ApplicationForm";

export const metadata: Metadata = {
  title: "Apply to Join | CnC Realty",
  description:
    "Apply to join CnC Realty. 100% commission, $0 monthly fees, E&O included.",
};

export default function ApplyPage() {
  return (
    <main data-navbar-theme="light" className="min-h-screen bg-[#F2F0EF]">
      <ApplicationForm />
    </main>
  );
}
