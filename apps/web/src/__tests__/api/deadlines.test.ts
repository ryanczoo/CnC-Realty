import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transactionFile: { findMany: vi.fn() },
  },
}));
vi.mock('@/lib/api-auth', () => ({ requireAuth: vi.fn() }));
vi.mock('@prisma/client', () => ({
  TransactionFileStatus: {
    INCOMPLETE: 'INCOMPLETE',
    PRE_CONTRACT: 'PRE_CONTRACT',
    PENDING: 'PENDING',
    EXPIRED: 'EXPIRED',
    CLOSED: 'CLOSED',
    ARCHIVED: 'ARCHIVED',
    CANCELED_PENDING: 'CANCELED_PENDING',
    CANCELED_APPROVED: 'CANCELED_APPROVED',
  },
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { GET } from '../../app/api/transactions/deadlines/route';

const mockSession = (role: string, id: string, agentId: string | null = null) => ({
  session: { user: { id, role, email: 'a@b.com', agentId } },
  error: null,
});

describe('GET /api/transactions/deadlines', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as any,
    });
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for BUYER role', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any,
    });
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    expect(res.status).toBe(403);
  });

  it('returns deadlines scoped to agent id (not user id)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockSession('AGENT', 'user-1', 'agent-cuid-1') as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([
      {
        id: 't1',
        propertyAddress: '123 Main St',
        closeOfEscrow: new Date(Date.now() + 86_400_000 * 3),
        inspectionDeadline: null,
        appraisalDeadline: null,
        loanApprovalDeadline: null,
        status: 'PENDING',
        agent: { user: { name: 'Agent A', email: 'agent@test.com' } },
      },
    ] as any);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deadlines).toHaveLength(1);
    expect(body.deadlines[0]).toMatchObject({ transactionId: 't1', label: 'Close of Escrow', daysOut: expect.any(Number) });
    expect(prisma.transactionFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: 'agent-cuid-1' }) })
    );
  });

  it('returns empty deadlines when agent record not found', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockSession('AGENT', 'user-orphan', null) as any);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deadlines).toHaveLength(0);
    expect(prisma.transactionFile.findMany).not.toHaveBeenCalled();
  });

  it('returns deadlines for ALL agents when ADMIN', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mockSession('ADMIN', 'admin-1', null) as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([] as any);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    expect(res.status).toBe(200);
    expect(prisma.transactionFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ agentId: expect.anything() }) })
    );
  });
});
