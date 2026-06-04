const PAYSTACK_BASE = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new PaystackError("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

export async function paystackRequest<T>(
  path: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: T;
  };

  if (!res.ok || json.status === false) {
    throw new PaystackError(
      json.message ?? `Paystack request failed (${res.status})`,
      res.status,
    );
  }

  return json.data as T;
}
