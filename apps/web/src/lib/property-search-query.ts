import { Prisma } from "@cnc/database";

export function buildLocationWhere(q: string): Prisma.PropertyWhereInput {
  if (/^\d{5}$/.test(q)) {
    return { zip: q };
  }
  if (/^\d/.test(q)) {
    return { address: { contains: q, mode: "insensitive" } };
  }
  return { city: { contains: q, mode: "insensitive" } };
}
