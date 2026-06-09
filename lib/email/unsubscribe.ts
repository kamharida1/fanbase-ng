import { createHmac, timingSafeEqual } from "node:crypto";

// Sentinel replaced at send-time with a real signed unsubscribe URL.
export const UNSUBSCRIBE_PLACEHOLDER = "__UNSUBSCRIBE_URL__";

const SECRET = process.env.UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fallback-dev-secret";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";

function sign(userId: string): string {
  return createHmac("sha256", SECRET).update(userId).digest("hex");
}

export function generateUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, sig: sign(userId) })).toString(
    "base64url",
  );
  return payload;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      uid: string;
      sig: string;
    };
    if (typeof decoded.uid !== "string" || typeof decoded.sig !== "string") return null;
    const expected = sign(decoded.uid);
    const sigBuf = Buffer.from(decoded.sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(userId: string): string {
  return `${APP_URL}/api/v1/unsubscribe?token=${generateUnsubscribeToken(userId)}`;
}
