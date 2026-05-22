import { EventWebhook } from '@sendgrid/eventwebhook';

const ew = new EventWebhook();

export function verifyWebhookSignature(
  publicKey: string,
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!publicKey) return false;
  try {
    const ecPublicKey = ew.convertPublicKeyToECDSA(publicKey);
    return ew.verifySignature(ecPublicKey, Buffer.from(rawBody), signature, timestamp);
  } catch {
    return false;
  }
}
