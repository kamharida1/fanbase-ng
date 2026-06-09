export type MediaUploadContext = "post" | "message" | "profile";

export type MediaStorageProvider = "r2" | "stream";

export type MediaUploadStatus =
  | "pending_upload"
  | "uploaded"
  | "scanning"
  | "ready"
  | "rejected"
  | "failed"
  | "expired";

export type MediaScanStatus =
  | "pending"
  | "clean"
  | "infected"
  | "skipped"
  | "error";

export type ContentScanStatus = "pending" | "clean" | "flagged" | "blocked" | "skipped" | "error";
export type ContentScanAction = "allow" | "review" | "block";

export type MediaUploadRow = {
  id: string;
  owner_id: string;
  context: MediaUploadContext;
  context_ref_id: string;
  provider: MediaStorageProvider;
  object_key: string | null;
  stream_uid: string | null;
  mime_type: string;
  original_filename: string;
  byte_size: number;
  status: MediaUploadStatus;
  scan_status: MediaScanStatus;
  scan_provider: string | null;
  scan_result: Record<string, unknown>;
  content_scan_status: ContentScanStatus;
  content_scan_action: ContentScanAction | null;
  content_scan_labels: Array<{ name: string; confidence: number; action: string }>;
  content_scan_sha256: string | null;
  content_scan_completed_at: string | null;
  bound_entity_type: string | null;
  bound_entity_id: string | null;
  expires_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PresignUploadResponse =
  | {
      uploadId: string;
      provider: "r2";
      uploadUrl: string;
      method: "PUT";
      headers: Record<string, string>;
      expiresAt: string;
    }
  | {
      uploadId: string;
      provider: "stream";
      uploadUrl: string;
      streamUid: string;
      expiresAt: string;
    };

export type ConfirmUploadResponse = {
  uploadId: string;
  status: MediaUploadStatus;
  scanStatus: MediaScanStatus;
  boundEntityId?: string;
  boundEntityType?: string;
};

export type MediaDeliveryResponse = {
  url: string;
  expiresAt: string;
  provider: MediaStorageProvider;
};
