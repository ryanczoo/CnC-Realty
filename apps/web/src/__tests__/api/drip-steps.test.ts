import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dripStep: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    campaign: { findUnique: vi.fn() },
    agent: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '../../app/api/campaigns/[id]/drip-steps/route';

describe('GET /api/campaigns/[id]/drip-steps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), { params: { id: 'c1' } });
    expect(res.status).toBe(401);
  });

  it('returns steps ordered by stepOrder when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'AGENT', agentId: 'a1' } } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: 'c1', agentId: 'a1' } as any);
    const mockSteps = [{ id: 's1', campaignId: 'c1', stepOrder: 1, delayDays: 0, subject: 'Hello', body: 'Hi!', createdAt: new Date() }];
    vi.mocked(prisma.dripStep.findMany).mockResolvedValue(mockSteps as any);

    const res = await GET(new Request('http://localhost'), { params: { id: 'c1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
  });
});

describe('POST /api/campaigns/[id]/drip-steps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify([]) }), { params: { id: 'c1' } });
    expect(res.status).toBe(401);
  });

  it('replaces steps and returns 200 when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'AGENT', agentId: 'a1' } } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: 'c1', agentId: 'a1' } as any);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined as any);

    const steps = [{ stepOrder: 1, delayDays: 0, subject: 'Welcome', body: 'Hi there!' }];
    const res = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(steps), headers: { 'Content-Type': 'application/json' } }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('returns 403 when campaign belongs to a different agent', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'AGENT', agentId: 'a2' } } as any);
    // Campaign is owned by agent 'a1', but the authenticated user is agent 'a2'
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: 'c1', agentId: 'a1' } as any);

    const steps = [{ stepOrder: 1, delayDays: 0, subject: 'Welcome', body: 'Hi there!' }];
    const res = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify(steps), headers: { 'Content-Type': 'application/json' } }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 when request body is malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'AGENT', agentId: 'a1' } } as any);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ id: 'c1', agentId: 'a1' } as any);

    const res = await POST(
      new Request('http://localhost', { method: 'POST', body: 'not-valid-json', headers: { 'Content-Type': 'application/json' } }),
      { params: { id: 'c1' } }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request body');
  });
});
