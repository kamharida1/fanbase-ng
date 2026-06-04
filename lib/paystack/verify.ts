import { createHmac, timingSafeEqual } from "crypto";

export function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signatureHeader) return false;

  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");

  try {
    const a = Buffer.from(hash, "utf8");
    const b = Buffer.from(signatureHeader, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
