import { EventWebhook } from '@sendgrid/eventwebhook';

export function verifyWebhookSignature(
  publicKey: string,
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!publicKey) return false;
  try {
    const ew = new EventWebhook();
    const ecPublicKey = ew.convertPublicKeyToECDH(publicKey);
    return ew.verifySignature(ecPublicKey, Buffer.from(rawBody), signature, timestamp);
  } catch {
    return false;
  }
}
