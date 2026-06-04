# Increment 9 — Secure media uploads (R2 + Stream)

## Architecture

```
Client                    API                         Storage
  │                        │                            │
  ├─ POST /media/presign ─►│ create media_uploads row   │
  │◄─ presigned URL ───────┤                            │
  ├─ PUT/POST upload ──────┼───────────────────────────► R2 or Stream
  ├─ POST /media/confirm ─►│ HeadObject / Stream status │
  │                        ├─ magic-byte validation     │
  │                        ├─ virus scan hook ─────────► VIRUS_SCAN_WEBHOOK_URL
  │◄─ ready / scanning ────┤                            │
  │                        │◄─ POST virus-scan webhook │
  ├─ GET /media/delivery ─►│ access check + signed GET│
```

## Features

| Requirement | Implementation |
|-------------|----------------|
| Cloudflare R2 | `@aws-sdk/client-s3` presigned PUT/GET |
| Cloudflare Stream | Direct upload URL + webhooks |
| Presigned uploads | `POST /api/v1/media/presign` |
| Virus scanning hooks | `VIRUS_SCAN_WEBHOOK_URL` + `POST /api/v1/media/webhooks/virus-scan` |
| File validation | MIME, size, extension, magic bytes on confirm |
| Video processing | Stream state webhook → `post_media.processing_status` |
| Access control | `can_view_post` / conversation participant / owner |

## Environment

See `.env.example` for `R2_*`, `CLOUDFLARE_*`, `MEDIA_WEBHOOK_SECRET`, `VIRUS_SCAN_*`.

## Virus scan integration

Your scanner receives:

```json
{
  "uploadId": "uuid",
  "ownerId": "uuid",
  "provider": "r2",
  "objectKey": "posts/...",
  "streamUid": null,
  "mimeType": "image/jpeg",
  "byteSize": 12345,
  "callbackUrl": "https://app/api/v1/media/webhooks/virus-scan",
  "callbackSecret": "<MEDIA_WEBHOOK_SECRET>"
}
```

Callback (header `x-media-webhook-secret`):

```json
{ "uploadId": "uuid", "status": "clean", "provider": "clamav" }
```

## Stream webhook

Configure Cloudflare Stream notifications to:

`POST https://<app>/api/v1/media/webhooks/stream`

Header: `x-media-webhook-secret: <MEDIA_WEBHOOK_SECRET>`

## Client helper

`uploadFileWithPresign` in `lib/media/client-upload.ts` — used by post editor and available for messaging/profile UIs.

## Migration

`20250610000001_secure_media_uploads.sql`

## Cron

`POST /api/internal/cron/expire-media-uploads` — hourly, expires stale `pending_upload` sessions.
