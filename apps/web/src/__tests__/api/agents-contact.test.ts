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
vi.mock("@/lib/newsletter", () => ({ subscribeToNewsletter: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from '@/lib/prisma';
import { subscribeToNewsletter } from '@/lib/newsletter';
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

describe('POST /api/agents/[slug]/contact — email check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses an invalid email without creating a lead', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    const req = new Request('http://localhost/api/agents/ryan-chong/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Smith', email: 'dsfsd dsfsdf', phone: '', message: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: { slug: 'ryan-chong' } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Please enter a valid email address.');
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/agents/[slug]/contact — newsletter', () => {
  beforeEach(() => vi.clearAllMocks());

  const send = () => POST(new Request('http://localhost/api/agents/ryan-chong/contact', {
    method: 'POST',
    body: JSON.stringify({ name: 'Jane Smith', email: ' jane@example.com ', phone: '', message: 'Hi' }),
    headers: { 'Content-Type': 'application/json' },
  }), { params: { slug: 'ryan-chong' } });

  it("enrolls the visitor into the newsletter on the agent's own lead", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead-7' } as any);
    const res = await send();
    expect(res.status).toBe(200);
    expect(subscribeToNewsletter).toHaveBeenCalledWith({ email: 'jane@example.com', leadId: 'lead-7', source: 'contact-form' });
  });

  it('still succeeds when enrollment fails', async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({ id: 'agent-1', slug: 'ryan-chong' } as any);
    vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead-7' } as any);
    vi.mocked(subscribeToNewsletter).mockRejectedValueOnce(new Error('db down'));
    const res = await send();
    expect(res.status).toBe(200);
  });
});
