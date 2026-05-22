import { describe, it, expect } from 'vitest';
import { verifyWebhookSignature } from '../../app/api/webhooks/sendgrid/verify';

describe('verifyWebhookSignature', () => {
  it('returns false when publicKey is empty', () => {
    expect(verifyWebhookSignature('', 'body', 'sig', '12345')).toBe(false);
  });

  it('returns false when signature is invalid for a given key', () => {
    expect(verifyWebhookSignature('not-a-real-key', 'body', 'badsig', '12345')).toBe(false);
  });
});
