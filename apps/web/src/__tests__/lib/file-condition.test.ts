import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("FileCondition model", () => {
  let agentId: string;
  let transactionFileId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `fc-test-${Date.now()}@test.com`, role: "AGENT" } });
    const agent = await prisma.agent.create({ data: { userId: user.id, slug: `fc-test-${Date.now()}` } });
    agentId = agent.id;
    const tf = await prisma.transactionFile.create({
      data: { agentId, propertyAddress: "1 Test St", city: "Test", zip: "00000", transactionSide: "BUYER_SIDE", status: "INCOMPLETE" },
    });
    transactionFileId = tf.id;
  });

  afterAll(async () => {
    await prisma.transactionFile.delete({ where: { id: transactionFileId } });
    await prisma.agent.delete({ where: { id: agentId } });
  });

  it("creates and links a condition to a transaction file", async () => {
    const condition = await prisma.fileCondition.create({
      data: { transactionFileId, name: "Inspection Contingency", dueDate: new Date("2026-08-01"), notes: "17 days after acceptance" },
    });
    expect(condition.name).toBe("Inspection Contingency");

    const withConditions = await prisma.transactionFile.findUnique({
      where: { id: transactionFileId },
      include: { conditions: true },
    });
    expect(withConditions?.conditions).toHaveLength(1);
  });
});
