import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFileAndVerifyAccess, resolveFileRef } from "@/lib/api-auth";
import { isFileReadOnlyFor } from "@/lib/file-lock";
import { FILE_LOCKED_MESSAGE } from "@/lib/file-messages";
import { trimStrings } from "@/lib/form-validation";

async function verifyPartyAccess(partyId: string, agentId: string | null, role: string) {
  const party = await prisma.fileParty.findUnique({ where: { id: partyId } });
  if (!party) return { error: "Not found", status: 404 } as const;

  const ref = resolveFileRef(party);
  if (!ref) return { error: "Not found", status: 404 } as const;

  const file = await getFileAndVerifyAccess(ref.fileType, ref.fileId, agentId, role);
  if (!file) return { error: "Forbidden", status: 403 } as const;
  if (isFileReadOnlyFor(ref.fileType, file.status, role)) return { error: FILE_LOCKED_MESSAGE, status: 403 } as const;

  return { party };
}

export async function PATCH(req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await verifyPartyAccess(params.partyId, session.user.agentId, session.user.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = trimStrings(await req.json());
  const updated = await prisma.fileParty.update({
    where: { id: params.partyId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.licenseNumber !== undefined && { licenseNumber: body.licenseNumber }),
    },
  });

  return NextResponse.json({ party: updated });
}

export async function DELETE(_req: Request, { params }: { params: { fileType: string; id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await verifyPartyAccess(params.partyId, session.user.agentId, session.user.role);
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  await prisma.fileParty.delete({ where: { id: params.partyId } });
  return NextResponse.json({ ok: true });
}
