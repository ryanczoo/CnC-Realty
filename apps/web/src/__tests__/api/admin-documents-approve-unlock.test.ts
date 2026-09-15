import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/email/transaction-emails", () => ({ sendAllDocsApproved: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fileDocument: { findUnique: vi.fn(), update: vi.fn() },
    fileActivity: { create: vi.fn() },
    fileChecklistItem: { findMany: vi.fn() },
    checklistTemplate: { findFirst: vi.fn() },
    listingFile: { findUnique: vi.fn(), update: vi.fn() },
    transactionFile: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { LISTING_PLACEHOLDER, TRANSFER_CHECKLIST_ITEM_NAME } from "@/lib/transfer-placeholder";
import { POST } from "../../app/api/admin/documents/[id]/approve/route";

const ADMIN = { user: { id: "admin-1", role: "ADMIN" } } as any;

const TEMPLATE_ITEMS = [
  { name: "Listing Agreement", description: "RLA", order: 0, isRequired: true },
  { name: "Agency Disclosure", description: "AD", order: 1, isRequired: true },
  { name: "Seller Property Questionnaire", description: null, order: 2, isRequired: false },
];

function placeholderListing(overrides: Record<string, unknown> = {}) {
  return {
    id: "listing-1",
    status: "PENDING_TRANSFER",
    propertyAddress: LISTING_PLACEHOLDER.propertyAddress,
    city: LISTING_PLACEHOLDER.city,
    zip: LISTING_PLACEHOLDER.zip,
    listPrice: LISTING_PLACEHOLDER.listPrice,
    listingType: LISTING_PLACEHOLDER.listingType,
    ...overrides,
  } as any;
}

function listingDoc() {
  return {
    id: "doc-1",
    fileType: "LISTING",
    listingFileId: "listing-1",
    transactionFileId: null,
    checklistItemId: "checklist-1",
    name: "signed.pdf",
  } as any;
}

function transactionDoc() {
  return {
    id: "doc-2",
    fileType: "TRANSACTION",
    listingFileId: null,
    transactionFileId: "tx-1",
    checklistItemId: "checklist-2",
    name: "signed.pdf",
  } as any;
}

async function approve(id: string) {
  const req = new Request(`http://localhost/api/admin/documents/${id}/approve`, { method: "POST" });
  return POST(req, { params: { id } });
}

describe("POST /api/admin/documents/[id]/approve — Critical 1: applies a checklist template on unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(ADMIN);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({
      id: "tpl-1",
      items: TEMPLATE_ITEMS,
    } as any);
  });

  it("looks up a LISTING template keyed on the file's own listingType, with the ALL fallback", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing());

    await approve("doc-1");

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fileType: "LISTING",
          isActive: true,
          OR: [{ listingType: LISTING_PLACEHOLDER.listingType }, { listingType: "ALL" }],
        }),
      })
    );
  });

  it("creates every template item on the listing file in the same update that unlocks it", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing());

    await approve("doc-1");

    const call = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("INCOMPLETE");
    expect(call.data.checklistItems.create).toHaveLength(TEMPLATE_ITEMS.length);
    expect(call.data.checklistItems.create[0]).toEqual({
      fileType: "LISTING",
      name: "Listing Agreement",
      description: "RLA",
      order: 0,
      isRequired: true,
    });
  });

  it("looks up a TRANSACTION template keyed on transactionSide and propertyCategory", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(transactionDoc());
    vi.mocked(prisma.transactionFile.findUnique).mockResolvedValue({
      id: "tx-1",
      status: "PENDING_TRANSFER",
      transactionSide: "PURCHASE",
      propertyCategory: "RESIDENTIAL",
    } as any);

    await approve("doc-2");

    expect(prisma.checklistTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fileType: "TRANSACTION",
          isActive: true,
          OR: [{ transactionSide: "PURCHASE" }, { transactionSide: "ALL" }],
          AND: [{ OR: [{ propertyCategory: "RESIDENTIAL" }, { propertyCategory: "ALL" }] }],
        }),
      })
    );

    const call = vi.mocked(prisma.transactionFile.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("INCOMPLETE");
    expect(call.data.checklistItems.create).toHaveLength(TEMPLATE_ITEMS.length);
  });

  it("still unlocks the file when no matching template exists", async () => {
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing());

    await approve("doc-1");

    const call = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;
    expect(call.data.status).toBe("INCOMPLETE");
    expect(call.data.checklistItems).toBeUndefined();
  });

  it("does not apply a template to a file that is not PENDING_TRANSFER", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing({ status: "INCOMPLETE" }));

    await approve("doc-1");

    expect(prisma.checklistTemplate.findFirst).not.toHaveBeenCalled();
    expect(prisma.listingFile.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/documents/[id]/approve — Critical 2: clears placeholder sentinels on unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(ADMIN);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ id: "tpl-1", items: TEMPLATE_ITEMS } as any);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
  });

  it("blanks the sentinel address, city and zip in the same update as the unlock", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing());

    await approve("doc-1");

    expect(prisma.listingFile.update).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;
    expect(call.data.propertyAddress).toBe("");
    expect(call.data.city).toBe("");
    expect(call.data.zip).toBe("");
  });

  it("does not clobber a real address the agent already saved on the locked panel", async () => {
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(
      placeholderListing({ propertyAddress: "742 Evergreen Terrace" })
    );

    await approve("doc-1");

    const call = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;
    expect(call.data.propertyAddress).toBeUndefined();
    expect(call.data.city).toBe("");
  });
});

describe("POST /api/admin/documents/[id]/approve — logs a STATUS_CHANGED activity on unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(ADMIN);
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ id: "tpl-1", items: TEMPLATE_ITEMS } as any);
  });

  it("records the PENDING_TRANSFER → INCOMPLETE transition", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing());

    await approve("doc-1");

    expect(prisma.fileActivity.create).toHaveBeenCalledWith({
      data: {
        fileType: "LISTING",
        listingFileId: "listing-1",
        transactionFileId: null,
        actorId: "admin-1",
        actorRole: "ADMIN",
        type: "STATUS_CHANGED",
        payload: { from: "PENDING_TRANSFER", to: "INCOMPLETE" },
      },
    });
  });

  it("does not record a STATUS_CHANGED activity when nothing unlocked", async () => {
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing({ status: "INCOMPLETE" }));

    await approve("doc-1");

    const types = vi.mocked(prisma.fileActivity.create).mock.calls.map((c: any) => c[0].data.type);
    expect(types).not.toContain("STATUS_CHANGED");
  });
});

/**
 * The seam every individual task's own tests missed: each task tested its own slice
 * correctly while the combined post-unlock end state was broken. This asserts the
 * whole resulting state of the file in one place.
 */
describe("POST /api/admin/documents/[id]/approve — integration: full post-unlock state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves the file INCOMPLETE, with a real compliance checklist and no sentinel values", async () => {
    vi.mocked(getServerSession).mockResolvedValue(ADMIN);
    vi.mocked(prisma.fileDocument.findUnique).mockResolvedValue(listingDoc());
    vi.mocked(prisma.listingFile.findUnique).mockResolvedValue(placeholderListing());
    vi.mocked(prisma.checklistTemplate.findFirst).mockResolvedValue({ id: "tpl-1", items: TEMPLATE_ITEMS } as any);

    // Post-unlock the file carries the original transfer item plus the seeded template.
    vi.mocked(prisma.fileChecklistItem.findMany).mockResolvedValue([
      { id: "checklist-1", name: TRANSFER_CHECKLIST_ITEM_NAME, isRequired: true, documents: [{ reviewStatus: "APPROVED" }] },
      ...TEMPLATE_ITEMS.map((t, i) => ({ id: `new-${i}`, name: t.name, isRequired: t.isRequired, documents: [] })),
    ] as any);

    await approve("doc-1");

    const call = vi.mocked(prisma.listingFile.update).mock.calls[0][0] as any;

    // 1. The file is unlocked.
    expect(call.data.status).toBe("INCOMPLETE");

    // 2. It has more than one checklist item — the transfer item plus the template.
    const created = call.data.checklistItems.create as { name: string }[];
    const finalItemCount = 1 + created.length;
    expect(finalItemCount).toBeGreaterThan(1);
    expect(created.map((i) => i.name)).toEqual(TEMPLATE_ITEMS.map((i) => i.name));

    // 3. No field is left holding a sentinel value.
    const resulting = { ...placeholderListing(), ...call.data };
    expect(resulting.propertyAddress).not.toBe(LISTING_PLACEHOLDER.propertyAddress);
    expect(resulting.city).not.toBe(LISTING_PLACEHOLDER.city);
    expect(resulting.zip).not.toBe(LISTING_PLACEHOLDER.zip);

    // 4. The file is therefore no longer trivially closeable with zero compliance docs.
    const { isReadyToClose } = await import("@/lib/transaction-helpers");
    const post = await vi.mocked(prisma.fileChecklistItem.findMany).mock.results[0].value;
    expect(isReadyToClose(post as any)).toBe(false);
  });
});
