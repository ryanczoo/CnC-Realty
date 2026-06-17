import { prisma } from "@/lib/prisma";

export async function applyTag(leadId: string, tagName: string): Promise<void> {
  const tag = await prisma.tag.upsert({
    where: { name: tagName },
    update: {},
    create: { name: tagName },
  });
  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId, tagId: tag.id } },
    update: {},
    create: { leadId, tagId: tag.id },
  });
}

export async function removeTag(leadId: string, tagId: string): Promise<void> {
  await prisma.leadTag.deleteMany({ where: { leadId, tagId } });
}
