import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/server-utils";
import { ApplicationsClient } from "./ApplicationsClient";

export const metadata = { title: "Agent Applications | CnC Realty Admin" };

export default async function AdminApplicationsPage() {
  await requireAdminPage();

  let applications: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    licenseNumber: string;
    licenseType: string;
    status: string;
    createdAt: Date;
  }[] = [];

  try {
    applications = await prisma.agentApplication.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        licenseNumber: true,
        licenseType: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // DB unreachable — show empty state
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-light text-[#1B1B1B]">Agent Applications</h1>
      </div>
      <ApplicationsClient applications={applications} />
    </div>
  );
}
