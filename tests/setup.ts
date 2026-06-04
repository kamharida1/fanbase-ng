import { vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.CRON_SECRET = "test-cron-secret-32chars-min";
process.env.PAYSTACK_SECRET_KEY = "sk_test_paystack_secret_key";
