import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function serializeTask(task: {
  id: string; leadId: string; title: string; taskType: string; notes: string | null;
  dueDate: Date | null; done: boolean; completedAt: Date | null; createdAt: Date;
  lead: { firstName: string; lastName: string };
}) {
  return {
    id: task.id,
    leadId: task.leadId,
    leadFirstName: task.lead.firstName,
    leadLastName: task.lead.lastName,
    title: task.title,
    taskType: task.taskType,
    notes: task.notes,
    dueDate: task.dueDate?.toISOString() ?? null,
    done: task.done,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const { session, error } = await requireAuth("AGENT");
  if (error) return error;

  const url = new URL(req.url);
  const doneParam = url.searchParams.get("done");
  const doneFilter = doneParam === "true" ? true : doneParam === "false" ? false : undefined;

  // Tasks are personal for everyone, admins included.
  const agentId = session.user.agentId;
  if (!agentId) return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });

  const tasks = await prisma.leadTask.findMany({
    where: {
      ...(doneFilter !== undefined ? { done: doneFilter } : {}),
      lead: { agentId },
    },
    include: { lead: { select: { firstName: true, lastName: true } } },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    take: 500,
  });

  return NextResponse.json(tasks.map(serializeTask));
}
