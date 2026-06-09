import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getContentScanMode, getRekognitionConfig } from "@/lib/media/config";
import { createR2PresignedGet } from "@/lib/media/r2/presign";
import type { MediaUploadRow } from "@/types/media";

// ─── Label sets ──────────────────────────────────────────────────────────────

// Rekognition top-level labels that warrant an immediate block.
const BLOCK_LABELS = new Set([
  "Explicit Nudity",
  "Nudity",
  "Graphic Male Nudity",
  "Graphic Female Nudity",
  "Sexual Activity",
  "Illustrated Nudity or Sexual Activity",
  "Hate Symbols",
  "Nazi Party",
  "White Supremacy",
]);

// Labels that send the upload to the human-review queue.
const REVIEW_LABELS = new Set([
  "Partial Nudity",
  "Suggestive",
  "Violence",
  "Graphic Violence",
  "Physical Violence",
  "Drug Products",
  "Drug Use",
  "Visually Disturbing",
  "Emaciated Bodies",
  "Air Crash",
]);

const BLOCK_CONFIDENCE_THRESHOLD = 75; // %
const REVIEW_CONFIDENCE_THRESHOLD = 80; // %
// Rekognition inline image limit is 5 MB; larger files go to manual review.
const MAX_INLINE_BYTES = 5 * 1024 * 1024;

const SCANNABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContentScanLabel = {
  name: string;
  confidence: number;
  action: "block" | "review";
};

export type ContentScanResult = {
  action: "allow" | "review" | "block";
  reason?: string;
  labels: ContentScanLabel[];
  sha256?: string;
  hashMatched: boolean;
  matchedCategory?: string;
};

// ─── Scanner ─────────────────────────────────────────────────────────────────

/**
 * Runs content moderation on a confirmed R2 image upload.
 *
 * Steps:
 * 1. SHA-256 exact match against `content_violation_hashes` (CSAM / NCII hashes).
 * 2. AWS Rekognition DetectModerationLabels for explicit/violent content.
 *
 * For Stream videos call `runContentScanFromUrl` with the thumbnail URL instead.
 */
export async function runContentScan(
  admin: SupabaseClient,
  upload: Pick<
    MediaUploadRow,
    "id" | "owner_id" | "object_key" | "mime_type" | "byte_size" | "provider"
  >,
): Promise<ContentScanResult> {
  const mode = getContentScanMode();
  if (mode === "off") {
    return allow();
  }

  if (upload.provider !== "r2" || !SCANNABLE_MIME_TYPES.has(upload.mime_type)) {
    return allow();
  }

  if (!upload.object_key) {
    return allow();
  }

  // Download the file bytes for scanning.
  let fileBytes: Uint8Array;
  try {
    const { url } = await createR2PresignedGet(upload.object_key);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`R2 fetch ${res.status}`);
    fileBytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    // Fetch failure is not a reason to block — let the upload proceed.
    return allow();
  }

  return runContentScanFromBytes(admin, fileBytes, upload.byte_size, mode);
}

/**
 * Runs content moderation on raw bytes (e.g. a thumbnail fetched from a URL).
 * Used by the Stream webhook handler to scan video thumbnails.
 */
export async function runContentScanFromUrl(
  admin: SupabaseClient,
  url: string,
  mode = getContentScanMode(),
): Promise<ContentScanResult> {
  if (mode === "off") return allow();

  let fileBytes: Uint8Array;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Thumbnail fetch ${res.status}`);
    fileBytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return allow();
  }

  return runContentScanFromBytes(admin, fileBytes, fileBytes.byteLength, mode);
}

async function runContentScanFromBytes(
  admin: SupabaseClient,
  fileBytes: Uint8Array,
  byteSize: number,
  mode: "hash-only" | "full",
): Promise<ContentScanResult> {
  const sha256 = createHash("sha256").update(fileBytes).digest("hex");

  // ── Step 1: SHA-256 hash match ────────────────────────────────────────────
  const { data: hashMatch } = await admin
    .from("content_violation_hashes")
    .select("category, severity")
    .eq("sha256_hex", sha256)
    .maybeSingle();

  if (hashMatch) {
    return {
      action: "block",
      reason: `Matched known ${hashMatch.category} content`,
      labels: [],
      sha256,
      hashMatched: true,
      matchedCategory: hashMatch.category as string,
    };
  }

  if (mode === "hash-only") {
    return { action: "allow", labels: [], sha256, hashMatched: false };
  }

  // ── Step 2: AWS Rekognition ────────────────────────────────────────────────
  const rekConfig = getRekognitionConfig();
  if (!rekConfig) {
    return { action: "allow", labels: [], sha256, hashMatched: false };
  }

  if (byteSize > MAX_INLINE_BYTES) {
    // File too large for inline scan; route to human review queue.
    return {
      action: "review",
      reason: "File exceeds automated scan size limit — manual review required",
      labels: [],
      sha256,
      hashMatched: false,
    };
  }

  try {
    const { RekognitionClient, DetectModerationLabelsCommand } = await import(
      "@aws-sdk/client-rekognition"
    );

    const client = new RekognitionClient({
      region: rekConfig.region,
      credentials: {
        accessKeyId: rekConfig.accessKeyId,
        secretAccessKey: rekConfig.secretAccessKey,
      },
    });

    const { ModerationLabels = [] } = await client.send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: fileBytes },
        MinConfidence: 50,
      }),
    );

    const labels: ContentScanLabel[] = [];
    let action: "allow" | "review" | "block" = "allow";
    let reason: string | undefined;

    for (const label of ModerationLabels) {
      const name = label.Name ?? "";
      const confidence = label.Confidence ?? 0;

      if (BLOCK_LABELS.has(name) && confidence >= BLOCK_CONFIDENCE_THRESHOLD) {
        labels.push({ name, confidence, action: "block" });
        action = "block";
        reason ??= `Detected: ${name} (${confidence.toFixed(1)}%)`;
      } else if (REVIEW_LABELS.has(name) && confidence >= REVIEW_CONFIDENCE_THRESHOLD) {
        labels.push({ name, confidence, action: "review" });
        if (action !== "block") {
          action = "review";
          reason ??= `Review required: ${name} (${confidence.toFixed(1)}%)`;
        }
      }
    }

    return { action, reason, labels, sha256, hashMatched: false };
  } catch {
    // Rekognition failure is not a reason to block.
    return { action: "allow", labels: [], sha256, hashMatched: false };
  }
}

function allow(): ContentScanResult {
  return { action: "allow", labels: [], hashMatched: false };
}
