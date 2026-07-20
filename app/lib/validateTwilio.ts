import { createHmac } from 'crypto';

// Validates that an inbound webhook request genuinely comes from Twilio.
// https://www.twilio.com/docs/usage/security#validating-signatures
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const sorted = Object.keys(params).sort();
  const str = url + sorted.map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', authToken).update(str, 'utf8').digest('base64');
  return signature === expected;
}
