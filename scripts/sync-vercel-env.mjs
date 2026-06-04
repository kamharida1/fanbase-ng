#!/usr/bin/env node
/**
 * Sync variables from .env.local to Vercel Production (non-interactive).
 * Usage: node scripts/sync-vercel-env.mjs [production-app-url]
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env.local");
const prodUrl =
  process.argv[2]?.replace(/\/$/, "") ?? "https://fanbase-ng.vercel.app";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
  "PAYSTACK_SECRET_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_STREAM_API_TOKEN",
  "CLOUDFLARE_STREAM_CUSTOMER_CODE",
  "MEDIA_WEBHOOK_SECRET",
  "VIRUS_SCAN_WEBHOOK_URL",
  "VIRUS_SCAN_MODE",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "WALLET_ENCRYPTION_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

function parseEnv(path) {
  const out = {};
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function addEnv(name, value) {
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--force"],
    {
      cwd: root,
      input: value,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  if (result.status === 0) {
    console.log(`  ✓ ${name}`);
    return true;
  }
  const err = (result.stderr || result.stdout || "").trim();
  console.error(`  ✗ ${name}: ${err.split("\n")[0]}`);
  return false;
}

const env = parseEnv(envFile);
console.log(`Syncing to Vercel Production (APP_URL=${prodUrl})…\n`);

let ok = 0;
let fail = 0;

if (addEnv("NEXT_PUBLIC_APP_URL", prodUrl)) ok++;
else fail++;

for (const key of KEYS) {
  const value = env[key]?.trim();
  if (!value) {
    console.log(`  − ${key} (skipped, empty in .env.local)`);
    continue;
  }
  if (addEnv(key, value)) ok++;
  else fail++;
}

console.log(`\nDone: ${ok} set, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
