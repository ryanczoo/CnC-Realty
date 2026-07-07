import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentApplication: { create: vi.fn() },
  },
}));
vi.mock('@/lib/email', () => ({
  sendApplicationNotification: vi.fn(),
}));
vi.mock('@/lib/ica-pdf', () => ({
  generateSignedIcaPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
}));
vi.mock('@/lib/r2', () => ({
  uploadToR2: vi.fn().mockResolvedValue(undefined),
  deleteR2Object: vi.fn().mockResolvedValue(undefined),
}));

// Mock reCAPTCHA verification — success by default
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ success: true, score: 0.9 }),
} as any);

import { prisma } from '@/lib/prisma';
import { uploadToR2, deleteR2Object } from '@/lib/r2';
import { POST } from '../../app/api/agent-applications/route';

const VALID_BODY = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  phone: '5551234567',
  address: '123 Main St',
  city: 'Los Angeles',
  state: 'CA',
  zip: '90001',
  dateOfBirth: '1985-06-15',
  licenseNumber: '01234567',
  licenseType: 'SALESPERSON',
  licenseExpDate: '2027-01-01',
  yearsLicensed: 5,
  formerBrokerage: 'Keller Williams',
  boardOfRealtors: '',
  mlsId: '',
  hasActiveListings: false,
  hasActiveSales: false,
  commissionEntity: 'PERSONAL',
  hasDisciplinaryHistory: false,
  disciplinaryExplain: '',
  hasInvestigationHistory: false,
  investigationExplain: '',
  drePerJuryCert: true,
  specialties: ['Residential'],
  bio: '',
  instagramUrl: '',
  facebookUrl: '',
  icaOpenedAt: '2026-06-30T14:00:00.000Z',
  icaAgreedAt: '2026-06-30T14:05:00.000Z',
  signatureName: 'Jane Smith',
  recaptchaToken: 'valid-token',
};

describe('POST /api/agent-applications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 if licenseNumber is not 8 digits', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, licenseNumber: '1234' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if required fields are missing', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, firstName: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if drePerJuryCert is false', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, drePerJuryCert: false }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("certification required");
  });

  it('returns 400 if signatureName does not match firstName/lastName', async () => {
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, signatureName: 'John Doe' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Signature must match');
  });

  it('persists desiredMembershipAssociation when provided', async () => {
    vi.mocked(prisma.agentApplication.create).mockResolvedValue({ id: 'app-2' } as any);
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_BODY, boardOfRealtors: 'Undecided', desiredMembershipAssociation: 'Ventura Coastal Association of REALTORS' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(prisma.agentApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          desiredMembershipAssociation: 'Ventura Coastal Association of REALTORS',
        }),
      })
    );
  });

  it('creates application and returns 201 for valid submission, with a signed ICA PDF uploaded to R2', async () => {
    vi.mocked(prisma.agentApplication.create).mockResolvedValue({ id: 'app-1' } as any);
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('app-1');

    expect(uploadToR2).toHaveBeenCalledWith(
      expect.stringMatching(/^signed-ica\/.+\.pdf$/),
      expect.any(Buffer),
      'application/pdf'
    );

    expect(prisma.agentApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'jane@example.com',
          licenseNumber: '01234567',
          submissionIp: '1.2.3.4',
          signedName: 'Jane Smith',
          signedIcaKey: expect.stringMatching(/^signed-ica\/.+\.pdf$/),
          icaVersion: expect.any(String),
        }),
      })
    );
  });

  it('cleans up the uploaded R2 object if the database insert fails', async () => {
    vi.mocked(prisma.agentApplication.create).mockRejectedValue(new Error('DB unique constraint violation'));
    const req = new Request('http://localhost/api/agent-applications', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(deleteR2Object).toHaveBeenCalledWith(expect.stringMatching(/^signed-ica\/.+\.pdf$/));
  });
});
