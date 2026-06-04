import { vi } from "vitest";

export function createQueryBuilder<T>(result: {
  data: T;
  error: null;
  count?: number;
}) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (
      onfulfilled?: (v: typeof result) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return builder;
}

export function createMockSupabase(overrides?: {
  from?: ReturnType<typeof vi.fn>;
  rpc?: ReturnType<typeof vi.fn>;
}) {
  return {
    from: overrides?.from ?? vi.fn(),
    rpc: overrides?.rpc ?? vi.fn(),
    auth: { getUser: vi.fn() },
  };
}
