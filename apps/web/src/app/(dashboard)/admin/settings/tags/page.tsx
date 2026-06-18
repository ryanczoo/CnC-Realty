import { requireAdminPage } from "@/lib/server-utils";
import { prisma } from "@/lib/prisma";
import { AdminTagsClient } from "./AdminTagsClient";

export const metadata = { title: "Tags | CnC Realty Admin" };

export default async function AdminTagsPage() {
  await requireAdminPage();

  const tags = await prisma.tag.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" },
  });

  const autoTagCitySetting = await prisma.siteSettings.findUnique({ where: { key: "autoTagCity" } });
  const autoTagCity = autoTagCitySetting?.value !== "false";

  return (
    <div>
      <h1 className="mb-8 font-sans text-2xl font-light text-[#1B1B1B]">Tags</h1>
      <AdminTagsClient
        initialTags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color, createdAt: t.createdAt.toISOString(), leadCount: t._count.leads }))}
        autoTagCity={autoTagCity}
      />
    </div>
  );
}
