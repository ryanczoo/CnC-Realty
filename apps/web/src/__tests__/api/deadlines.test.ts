import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    transactionFile: { findMany: vi.fn() },
  },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
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
import { getServerSession } from 'next-auth';
import { GET } from '../../app/api/transactions/deadlines/route';

const mockSession = (role: string, id: string) => ({ user: { id, role, email: 'a@b.com' } });

describe('GET /api/transactions/deadlines', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for BUYER role', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession('BUYER', 'buyer-1') as any);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    expect(res.status).toBe(403);
  });

  it('returns deadlines scoped to agent id (not user id)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession('AGENT', 'user-1') as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-cuid-1' } as any);
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
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' }, select: { id: true } });
    expect(prisma.transactionFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: 'agent-cuid-1' }) })
    );
  });

  it('returns empty deadlines when agent record not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession('AGENT', 'user-orphan') as any);
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deadlines).toHaveLength(0);
    expect(prisma.transactionFile.findMany).not.toHaveBeenCalled();
  });

  it('returns deadlines for ALL agents when ADMIN', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession('ADMIN', 'admin-1') as any);
    vi.mocked(prisma.transactionFile.findMany).mockResolvedValue([] as any);
    const res = await GET(new Request('http://localhost/api/transactions/deadlines'));
    expect(res.status).toBe(200);
    expect(prisma.transactionFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ agentId: expect.anything() }) })
    );
  });
});
