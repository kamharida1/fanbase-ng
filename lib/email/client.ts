import { Resend } from "resend";

let _client: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

export function getFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL ??
    "Fanbase NG <notifications@fanbaseng.com>"
  );
}

export const REPLY_TO = "support@fanbaseng.com";
