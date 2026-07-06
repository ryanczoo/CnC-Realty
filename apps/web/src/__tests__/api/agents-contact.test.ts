import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agent: { findUnique: vi.fn() },
    lead: { create: vi.fn() },
  },
}));
vi.mock('@/lib/rate-limit', () => ({
  publicFormRateLimit: { limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }) },
}));

import { prisma } from '@/lib/prisma';
import { POST } from '../../app/api/agents/[slug]/contact/route';

describe('POST /api/agents/[slug]/contact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when agent slug does not exist', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);
    const req = new Request('http://localhost/api/agents/unknown/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com', phone: '', message: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: { slug: 'unknown' } });
    expect(res.status).toBe(404);
  });

  it('creates a lead and returns 200 for a valid agent', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({} as any);

    const req = new Request('http://localhost/api/agents/ryan-chong/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Smith', email: 'jane@example.com', phone: '555-1234', message: 'Interested!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: { slug: 'ryan-chong' } });
    expect(res.status).toBe(200);
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'agent-1', email: 'jane@example.com' }),
      })
    );
  });
});
