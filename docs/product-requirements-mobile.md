# Fanbase NG — Mobile App Product Requirements Document

**Status:** Draft v1.0
**Owner:** CTO / Product
**Scope:** Native mobile creator-subscription platform (OnlyFans-class) for the Nigerian market
**Stack:** React Native (Expo) · Supabase (Auth/Postgres/Realtime) · PostgreSQL · Paystack · Cloudflare R2 (storage) + Cloudflare Stream (video)

> **Stack note:** Cloudflare R2/Stream is the confirmed media provider for both the mobile app and the existing Fanbase NG web app (this repo) — one media vendor, one upload pipeline, shared `creator_id`/`subscription_id` domain model across both Supabase Postgres-backed clients.

---

## 1. Full Feature Breakdown

### 1.1 Identity & Accounts
- Email/phone + password auth, Google/Apple OAuth (Supabase Auth)
- Dual role model: `fan` and `creator` (single account can hold both; `is_creator` flag gates creator UI)
- Profile: display name, handle (`@username`), avatar, cover image, bio, social links
- Creator application flow → KYC → approval → creator dashboard unlocked
- Account settings: privacy, blocked users, notification preferences, linked payout/bank account

### 1.2 Creator Onboarding & KYC
- Step 1: Creator intent form (category, content type, expected pricing)
- Step 2: Government ID upload (NIN/driver's license/international passport) + selfie liveness check
- Step 3: BVN or bank account verification via Paystack's identity/account-resolve API
- Step 4: Age verification (18+, double-checked against ID DOB)
- Step 5: Agreement to creator terms + content policy
- Admin review queue (manual approval for v1, automated risk scoring for v2)
- Status states: `pending`, `under_review`, `approved`, `rejected`, `suspended`

### 1.3 Subscriptions & Monetization
- Subscription tiers per creator (e.g., Free preview / Basic / VIP), each with price (NGN), billing interval (monthly default; weekly/quarterly optional), perks description
- Recurring billing via Paystack subscriptions/plans + saved card tokenization
- Pay-Per-View (PPV) unlocks: one-off purchase of a specific post/message/media bundle
- Tipping: ad-hoc payments to a creator (post, DM, livestream)
- Bundles/discounts: multi-month subscription discounts
- Free trial toggle (creator-configurable, default off — fraud risk)
- Subscription lifecycle: active → past_due (failed charge, grace period 3 days) → canceled/expired
- Fan-initiated cancel (effective end of billing period, no pro-rated refund per OnlyFans norm)

### 1.4 Content & Feed
- Creator posts: text, image(s), video, audio, locked/unlocked flag, PPV price if locked
- Home feed: reverse-chron feed of subscribed creators + promoted/suggested posts
- Explore page: trending creators, categories, "new creators," search-driven discovery
- Stories: 24h ephemeral media, viewable by subscribers only (or public teaser per creator setting)
- Bookmarks: save posts for later (private to fan)
- Likes, comments (threaded, 1 level), comment moderation (creator can delete/hide on own posts)
- Media gating: blurred/locked preview thumbnail for non-subscribers or unpurchased PPV

### 1.5 Messaging (DMs)
- 1:1 DM threads, fan↔creator and creator↔creator (optional)
- Text, image, video, voice note messages
- Paid DMs: creator can attach a price to unlock a message/media inside a DM
- Mass DM / broadcast to all subscribers (creator tool, rate-limited)
- Read receipts (creator-side toggle), typing indicators
- Request inbox: non-subscribers can send one "intro" DM (creator can charge to reply, configurable)
- Block/report from within a thread

### 1.6 Live Streaming (Architecture, Phased)
- **MVP:** Not shipped; this PRD defines the architecture only (§ scalability/API).
- **Phase 2:** RTMP/SRT ingest → Cloudflare Stream Live → HLS playback in-app, paid-entry or subscriber-only gating, live tipping overlay, live chat (Supabase Realtime channel), live PPV ("locked stream" unlock).
- Recording auto-archives to VOD post after stream ends (creator opt-in).

### 1.7 Search & Discovery
- Search creators by handle/display name, category, tags
- Filters: price range, verified-only, online/active recently, content type
- Trending algorithm v1: weighted recent engagement (subs gained, likes, tips) over rolling 7-day window
- Explore categories curated by admin + auto-tag from creator profile

### 1.8 Creator Analytics Dashboard
- Earnings overview: gross, net (after platform fee + Paystack fee), by source (subs/PPV/tips/DMs)
- Subscriber growth chart, churn rate, active vs expired
- Post performance: views, likes, comments, unlock rate (for PPV)
- Payout history and next scheduled payout
- Audience demographics (aggregate, anonymized — country/state breakdown given Nigeria focus)

### 1.9 Wallet & Payouts
- Internal NGN wallet per creator: ledger of credits (subscriptions, tips, PPV, DMs) and debits (platform fee, payout withdrawals, refunds/chargebacks)
- Wallet balance shown in kobo internally, rendered as Naira
- Payout methods: Nigerian bank account via Paystack Transfers (Recipient API)
- Payout schedule: on-demand withdrawal (min threshold ₦5,000) + optional auto-weekly payout
- Payout hold period: configurable (e.g., 3-day hold on new funds to cover chargebacks/refund window)
- Full transaction history (fan-side: purchases/receipts; creator-side: earnings ledger)

### 1.10 Trust, Safety & Compliance
- Content moderation queue: AI pre-screen (NSFW/CSAM hash-matching, e.g., PhotoDNA/Hive Moderation) + human review for flagged content
- User reporting: report post/profile/message/comment with reason taxonomy
- Admin dashboard: user management, creator approval queue, report queue, content takedown, ban/suspend, payout holds
- Age/identity verification audit trail (immutable log for compliance)
- DMCA/takedown request handling workflow
- Referral system: unique referral code/link per user, referral reward (cash credit or fee discount) on referred-creator's first payout or referred-fan's first subscription

### 1.11 Notifications
- Push (Expo push notifications) + in-app notification center
- Triggers: new subscriber, new tip, new PPV unlock, new DM, new comment/like on own post, subscription renewal success/failure, payout completed, creator went live, content from subscribed creator
- Notification preference granularity (per category, push vs in-app only)

---

## 2. Database Architecture (High Level)

**Engine:** PostgreSQL via Supabase, Row Level Security (RLS) enforced on every fan/creator-facing table. Service-role key used only in trusted backend functions (Edge Functions / API routes), never client-side.

```
┌────────────────────────────────────────────────────────────────────┐
│                          Auth Layer (Supabase Auth)                 │
│  auth.users  ──1:1──>  public.profiles                              │
└────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────┐
│  creators    │──▶│ subscription │──▶│ subscriptions │──▶│ payments │
│  (KYC, plan) │   │     _tiers   │   │  (fan↔creator) │   │ (ledger) │
└─────────────┘   └──────────────┘   └───────────────┘   └──────────┘
        │                                                       │
        ▼                                                       ▼
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────┐
│    posts     │──▶│  post_media  │   │   pay_per_views│  │ wallets  │
└─────────────┘   └──────────────┘   └───────────────┘   │ledger_txn│
        │                                                  └──────────┘
        ▼
┌─────────────┐   ┌──────────────┐   ┌───────────────┐
│  comments    │   │    likes     │   │  bookmarks    │
└─────────────┘   └──────────────┘   └───────────────┘

┌─────────────┐   ┌──────────────┐   ┌───────────────┐
│ conversations│──▶│   messages   │──▶│ message_unlocks│
└─────────────┘   └──────────────┘   └───────────────┘

┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────┐
│   stories    │   │   reports    │   │  notifications │  │ referrals│
└─────────────┘   └──────────────┘   └───────────────┘   └──────────┘
```

Design principles:
- Money fields always `bigint` in **kobo** (no floats).
- Every monetizable action writes an immutable row to `transactions` (single source of truth ledger) before any wallet balance mutation — wallet balance is a derived/cached value, recomputable from the ledger.
- Soft-delete (`deleted_at`) on user-generated content for moderation/audit trail; hard-delete only via scheduled GDPR/NDPR erasure job.
- All media references store `provider`, `key` (R2 object key, or Stream video UID for video), and `cdn_url` — schema stays vendor-agnostic even though R2/Stream is the confirmed choice.

---

## 3. Supabase Table Schemas (Core Set)

```sql
-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  cover_url text,
  bio text,
  is_creator boolean not null default false,
  is_verified boolean not null default false,
  country text default 'NG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creators (KYC + payout config)
create table creators (
  id uuid primary key references profiles(id) on delete cascade,
  kyc_status text not null default 'pending'
    check (kyc_status in ('pending','under_review','approved','rejected','suspended')),
  kyc_document_url text,
  kyc_selfie_url text,
  bvn_verified boolean default false,
  paystack_recipient_code text,
  category text,
  payout_hold_days int not null default 3,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Subscription tiers (creator-defined pricing)
create table subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  name text not null,
  price_kobo bigint not null check (price_kobo >= 0),
  interval text not null default 'monthly' check (interval in ('weekly','monthly','quarterly')),
  perks text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Subscriptions (fan -> creator)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references profiles(id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  tier_id uuid not null references subscription_tiers(id),
  paystack_subscription_code text,
  status text not null default 'active'
    check (status in ('active','past_due','canceled','expired')),
  current_period_end timestamptz not null,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (fan_id, creator_id)
);

-- Posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  caption text,
  visibility text not null default 'subscribers'
    check (visibility in ('public','subscribers','ppv')),
  ppv_price_kobo bigint,
  like_count int not null default 0,
  comment_count int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Post media (Cloudflare R2 for images, Cloudflare Stream for video)
create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','audio')),
  provider text not null default 'cloudflare',
  storage_key text not null,     -- R2 object key (image/audio) or Stream video UID
  cdn_url text not null,
  thumbnail_url text,
  duration_seconds int,
  sort_order int not null default 0
);

-- Pay-per-view unlocks
create table pay_per_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  fan_id uuid not null references profiles(id) on delete cascade,
  amount_kobo bigint not null,
  transaction_id uuid references transactions(id),
  unlocked_at timestamptz not null default now(),
  unique (post_id, fan_id)
);

-- Comments / Likes / Bookmarks
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id),
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table bookmarks (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Stories
create table stories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  media_url text not null,
  provider text not null default 'cloudflare',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

-- Messaging
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz,
  unique (user_a, user_b)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text,
  media_url text,
  is_locked boolean not null default false,
  unlock_price_kobo bigint,
  created_at timestamptz not null default now()
);

create table message_unlocks (
  message_id uuid not null references messages(id) on delete cascade,
  fan_id uuid not null references profiles(id) on delete cascade,
  transaction_id uuid references transactions(id),
  unlocked_at timestamptz not null default now(),
  primary key (message_id, fan_id)
);

-- Money: single ledger of truth
create table transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in
    ('subscription','ppv_post','ppv_message','tip','payout','refund','platform_fee')),
  payer_id uuid references profiles(id),
  payee_id uuid references profiles(id), -- creator receiving funds
  amount_kobo bigint not null,
  platform_fee_kobo bigint not null default 0,
  paystack_reference text unique,
  status text not null default 'pending'
    check (status in ('pending','success','failed','reversed')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Wallets (cached balance, derived from transactions)
create table wallets (
  creator_id uuid primary key references creators(id) on delete cascade,
  available_kobo bigint not null default 0,
  pending_kobo bigint not null default 0, -- in payout hold period
  updated_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  amount_kobo bigint not null,
  paystack_transfer_code text,
  status text not null default 'pending'
    check (status in ('pending','processing','success','failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Reports & moderation
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  target_type text not null check (target_type in ('post','profile','message','comment')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

-- Referrals
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id),
  referred_id uuid not null references profiles(id) unique,
  code text not null,
  reward_kobo bigint,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
```

**RLS pattern (example — posts):**
```sql
alter table posts enable row level security;

create policy "creators manage own posts"
  on posts for all
  using (creator_id = auth.uid());

create policy "subscribers read subscriber posts"
  on posts for select
  using (
    visibility = 'public'
    or (visibility = 'subscribers' and exists (
      select 1 from subscriptions s
      where s.creator_id = posts.creator_id
        and s.fan_id = auth.uid()
        and s.status = 'active'
    ))
    or (visibility = 'ppv' and exists (
      select 1 from pay_per_views p
      where p.post_id = posts.id and p.fan_id = auth.uid()
    ))
  );
```

---

## 4. API Architecture

**Pattern:** Supabase client (PostgREST + Realtime) for direct, RLS-protected CRUD from the app. A thin **server layer** (Next.js Route Handlers or Supabase Edge Functions) owns anything involving money, third-party secrets, or cross-table invariants — the mobile app never talks to Paystack or Cloudflare's R2/Stream APIs directly with privileged keys.

```
Mobile App (Expo)
   │
   ├── Supabase JS client ──────────► PostgREST (RLS-scoped reads/writes)
   │                                   - feed queries, profile reads,
   │                                     likes/comments/bookmarks
   │
   ├── Supabase Realtime ───────────► Live chat, notification stream, live tip ticker
   │
   └── HTTPS ──────────────────────► Backend API (Edge Functions / Next.js API)
                                       /api/subscriptions/create
                                       /api/ppv/unlock
                                       /api/tips/send
                                       /api/messages/unlock
                                       /api/payouts/request
                                       /api/uploads/sign        (R2 presigned PUT / Stream direct-upload URL)
                                       /api/webhooks/paystack   (charge.success, subscription events)
                                       /api/webhooks/stream     (video.live_input/video ready, moderation callbacks)
                                       /api/kyc/submit
                                       /api/admin/*             (service-role only, behind admin auth)
```

Key endpoint contracts (representative):

| Endpoint | Method | Auth | Responsibility |
|---|---|---|---|
| `/api/subscriptions/create` | POST | fan JWT | Init Paystack transaction, create `pending` subscription row |
| `/api/webhooks/paystack` | POST | Paystack signature (HMAC-SHA512) | Verify, write `transactions` row, flip subscription to `active`, credit wallet |
| `/api/ppv/unlock` | POST | fan JWT | Charge saved card or redirect to Paystack, insert `pay_per_views` row idempotently |
| `/api/tips/send` | POST | fan JWT | One-off charge, credit creator wallet, push notification |
| `/api/payouts/request` | POST | creator JWT | Validate available balance ≥ threshold, call Paystack Transfer, insert `payouts` row |
| `/api/uploads/sign` | POST | creator JWT | Return short-lived R2 presigned upload URL (images/audio) or Stream direct-upload URL (video); never expose R2/Stream API tokens client-side |
| `/api/kyc/submit` | POST | user JWT | Store doc refs, enqueue admin review |
| `/api/admin/creators/:id/approve` | POST | admin JWT (RLS + role check) | Approve/reject KYC, triggers wallet creation |

**Idempotency:** every money-moving endpoint requires a client-generated `idempotency_key`, stored unique on `transactions.metadata->>'idempotency_key'`, to survive retries on flaky mobile networks.

**Webhook security:** verify Paystack `x-paystack-signature` against raw body before processing; verify Cloudflare Stream webhook signatures similarly. Never trust client-reported payment success — webhooks are the source of truth.

---

## 5. React Native (Expo) Folder Structure

```
fanbase-mobile/
├── app/                          # expo-router file-based routes
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (onboarding)/
│   │   ├── creator-apply.tsx
│   │   ├── kyc-upload.tsx
│   │   └── kyc-status.tsx
│   ├── (fan)/
│   │   ├── feed.tsx
│   │   ├── explore.tsx
│   │   ├── search.tsx
│   │   ├── bookmarks.tsx
│   │   └── profile/[username].tsx
│   ├── (creator)/
│   │   ├── dashboard.tsx
│   │   ├── analytics.tsx
│   │   ├── posts/new.tsx
│   │   ├── posts/[id]/edit.tsx
│   │   ├── wallet.tsx
│   │   ├── payouts.tsx
│   │   └── subscribers.tsx
│   ├── (messages)/
│   │   ├── inbox.tsx
│   │   └── thread/[conversationId].tsx
│   ├── (live)/
│   │   ├── go-live.tsx
│   │   └── watch/[streamId].tsx
│   ├── (admin)/
│   │   ├── reports.tsx
│   │   ├── kyc-queue.tsx
│   │   └── users.tsx
│   ├── post/[id].tsx
│   ├── story/[id].tsx
│   └── _layout.tsx
├── components/
│   ├── ui/                       # Button, Input, Avatar, Modal, Skeleton
│   ├── feed/                     # PostCard, LockedMediaOverlay, StoryRing
│   ├── messaging/                # MessageBubble, PaidMessageLock
│   ├── creator/                  # TierCard, EarningsChart, SubscriberRow
│   └── shared/                   # ReportSheet, ConfirmDialog
├── lib/
│   ├── supabase/                 # client init, typed db helpers
│   ├── paystack/                 # checkout webview wrapper, plan helpers
│   ├── cloudflare/                # R2 presigned upload client, Stream player/upload helpers
│   ├── api/                      # fetch wrappers for backend endpoints
│   ├── notifications/            # expo-notifications setup, token registration
│   └── analytics/                # event tracking (PostHog/Amplitude)
├── hooks/
│   ├── useSubscription.ts
│   ├── useWallet.ts
│   ├── useFeed.ts
│   └── useRealtimeChat.ts
├── stores/                       # Zustand or Jotai: auth, feed cache, draft post
├── types/                        # generated Supabase types + domain types
├── constants/                    # pricing tiers, fee %, theme tokens
├── assets/
├── app.config.ts                 # Expo config (EAS profiles, env per environment)
├── eas.json
└── package.json
```

State/data conventions:
- **TanStack Query** for all server state (feed, profile, wallet) layered on Supabase client — handles caching/retry/pagination for free.
- **Zustand** for local/client-only state (draft post composer, auth session mirror).
- Supabase Realtime subscriptions wrapped in hooks (`useRealtimeChat`, `useLiveTipFeed`) that hydrate the Query cache rather than maintaining parallel state.

---

## 6. User Flows

**Fan: discover → subscribe → consume**
1. Open app → Explore/Feed (public posts visible logged-out as growth lever)
2. Tap creator → profile (bio, tier cards, locked preview grid)
3. Select tier → Paystack checkout (in-app WebView/inline card) → webhook confirms → subscription active
4. Feed updates to include creator's subscriber-only posts
5. Fan can tip, send DM, unlock PPV posts independently of subscription

**Creator: apply → KYC → first post → first payout**
1. Fan account → "Become a Creator" → category + content questionnaire
2. KYC step: ID + selfie + bank account → submitted, status `under_review`
3. Admin approves → `creators` row flips `approved`, wallet row created
4. Creator sets up tiers → publishes first post (free teaser + locked premium)
5. Subscribers convert → wallet accrues → after hold period, creator requests payout → Paystack Transfer → bank credit

**PPV unlock flow**
1. Fan sees blurred post with price tag
2. Tap "Unlock for ₦X" → confirm → charge (saved card or new Paystack auth) → webhook fires → `pay_per_views` row inserted → UI unblurs optimistically pending webhook confirmation (with rollback on failure)

**Report/moderation flow**
1. Fan/creator taps "Report" on content → reason picker → submitted to `reports`
2. Appears in admin queue, sorted by severity/recency
3. Admin reviews, takes action (dismiss / remove content / suspend user) → audit log entry written

---

## 7. Monetization Architecture

| Revenue stream | Mechanism | Platform cut (suggested) |
|---|---|---|
| Subscriptions | Recurring Paystack charge, auto-renew | 15–20% |
| Pay-per-view | One-off charge per post/message | 15–20% |
| Tips | One-off charge, no content gating | 10–15% (lower friction = more volume) |
| Paid DMs | One-off charge to unlock message | 15–20% |
| Live stream entry/tips | One-off + recurring during stream | 15–20% |
| Referral payouts | Platform-funded acquisition cost | Cost center, capped per referral |

**Fee flow per transaction:**
```
Gross amount (₦1,000)
  → Paystack processing fee (~1.5% + ₦100, capped ₦2,000) deducted at settlement
  → Platform fee (15-20% of gross, business decision) credited to platform revenue account
  → Net credited to creator wallet (pending_kobo) → moves to available_kobo after hold period
```

All fee percentages must be config-driven (`platform_config` table or env-managed feature flags), not hardcoded, since promotional fee waivers are a common creator-acquisition lever.

**Payout settlement:** batch or on-demand via Paystack Transfers API; reconcile nightly against `transactions` ledger to catch drift (cron job comparing `sum(wallets.available_kobo)` to `sum(transactions where status='success') - sum(payouts where status='success')`).

---

## 8. Security Architecture

- **Auth:** Supabase Auth (JWT), short-lived access tokens + refresh rotation; biometric app-lock (Face ID/fingerprint) for wallet/payout screens.
- **RLS everywhere:** no table accessible to anon/authenticated role without an explicit policy; service-role key confined to backend functions, never bundled in the Expo app.
- **Payments:** PCI scope minimized — card entry happens inside Paystack's hosted checkout/WebView, never custom card forms. Webhook signature verification mandatory (§4).
- **Media access control:** locked content is served via **R2 presigned GET URLs** (short TTL) for images/audio and **Cloudflare Stream signed tokens** for video, generated server-side only after entitlement check (subscription active / PPV unlocked) — never rely on "security by obscurity" object keys; R2 buckets stay private (no public bucket access).
- **KYC data:** ID images/selfies stored in a private R2 bucket (separate from public-facing content bucket) with restricted access; encrypt BVN/sensitive identifiers at rest (pgcrypto or app-level AES-256-GCM, consistent with existing wallet-encryption approach used on the web app).
- **Rate limiting:** Edge Function/API gateway throttling on auth, messaging (anti-spam mass-DM), and payment endpoints (Upstash Redis token bucket, same pattern as the web app).
- **Abuse/CSAM prevention:** mandatory automated hash-matching (PhotoDNA or Hive/Thorn Safer) on all uploaded media before it becomes visible; legal obligation, not optional, in adult-adjacent platforms.
- **Audit logging:** immutable append-only log for KYC decisions, content takedowns, payout approvals, admin role actions.
- **App security:** certificate pinning for API calls, jailbreak/root detection warning (soft block for payment flows), no sensitive data in `AsyncStorage` unencrypted (use `expo-secure-store` for tokens).
- **NDPR compliance:** Nigeria Data Protection Act — explicit consent capture at signup, data subject access/erasure request workflow, data residency consideration for KYC documents.

---

## 9. Scalability Recommendations

- **Database:** Supabase Postgres with read replicas once feed read QPS grows; partition `transactions` and `messages` by month once table size exceeds ~50M rows.
- **Feed generation:** Start with pull-based query (subscribed creators' recent posts, paginated cursor-based). Move to a fan-out write model (precomputed feed table) only when subscription graph fan-out becomes a bottleneck (typically >100k DAU).
- **Media delivery:** Cloudflare's CDN/edge network handles global caching for R2 objects at zero egress fee; Cloudflare Stream auto-generates adaptive bitrate HLS/DASH renditions for video rather than serving raw uploads.
- **Realtime:** Supabase Realtime channels scoped per conversation/stream, not global — avoid one giant broadcast channel.
- **Live streaming:** Use Cloudflare Stream Live (RTMP/SRT ingest → HLS playback) rather than self-hosting — same vendor as VOD storage, no separate live-infra contract needed.
- **Background jobs:** Move payout batching, ledger reconciliation, story-expiry cleanup, and moderation hash-scanning to a queue (Supabase pg_cron + Edge Functions, or a managed queue like Upstash QStash) — keep these off the request path.
- **Caching:** CDN-cache public profile/explore pages aggressively; cache subscriber-count/feed-count aggregates rather than recomputing per request.
- **Mobile app:** Use Expo's OTA updates (EAS Update) for JS-only fixes; native module changes still require store review — plan release cadence accordingly.

---

## 10. Recommended Third-Party Services

| Need | Recommendation | Notes |
|---|---|---|
| Auth/DB/Realtime | Supabase | Already the backend of record |
| Payments (NG) | Paystack | Subscriptions, Transfers (payouts), Recipient/BVN resolve |
| Media storage/CDN | Cloudflare R2 (images/audio) + Cloudflare Stream (video) | Zero egress fees, presigned/signed delivery URLs, shared with the existing web app |
| Live streaming | Cloudflare Stream Live | RTMP/SRT ingest + HLS playback, same vendor as VOD, avoid self-hosting |
| Push notifications | Expo Push Notification service | Native integration with Expo/React Native |
| CSAM/abuse detection | Hive Moderation or Thorn Safer | Legal necessity for adult-content-adjacent platforms |
| Error monitoring | Sentry | Consistent with existing web stack |
| Analytics/product events | PostHog or Amplitude | Funnel tracking: signup → KYC → first sub |
| Rate limiting | Upstash Redis | Consistent with existing web stack |
| Background jobs/queue | Supabase pg_cron + Edge Functions, or Upstash QStash | Payout batching, reconciliation |
| Transactional email/SMS | Termii or Africa's Talking (NG-focused) for SMS OTP; Resend for email | Local SMS deliverability matters in Nigeria |
| App distribution | EAS Build + EAS Submit | Standard Expo production pipeline |

---

## 11. MVP vs Advanced Features

### MVP (Launch-blocking)
- Auth (email/phone), profile setup
- Creator application + manual KYC review (no automated risk scoring yet)
- Subscription tiers + Paystack recurring billing
- Feed (subscribed creators), public preview posts
- Post creation: image/audio upload to Cloudflare R2, video upload to Cloudflare Stream, locked/unlocked toggle
- PPV unlock for posts
- Likes, comments, bookmarks
- 1:1 DMs (text + media, no paid-DM yet)
- Tipping
- Wallet (balance view) + manual/on-demand payout request
- Basic notifications (push: new subscriber, new tip, new message)
- Search (creator name/handle only)
- Reporting (post/profile) + minimal admin queue (approve KYC, review reports)
- Transaction history (fan + creator)

### Phase 2 (Post-launch, 60–90 days)
- Stories (24h ephemeral)
- Paid DMs, mass DM broadcast
- Explore page with categories/trending algorithm
- Referral system
- Creator analytics dashboard (charts, churn, demographics)
- Automated payout scheduling (auto-weekly)
- Verification badges (manual admin grant initially)
- Free trial subscriptions

### Phase 3 (Advanced / Scale)
- Live streaming (full architecture from §1.6)
- Automated KYC risk scoring / liveness-check vendor integration (e.g., Smile Identity, given NG context)
- Advanced moderation (AI pre-screen + human-in-the-loop SLA tooling)
- Subscription bundles/discounts, gifting subscriptions
- Multi-language support
- Creator collaboration/co-posting

---

## 12. Estimated Cost Optimization Strategy

**Principles:**
- Pay-as-you-go on every vendor until DAU/revenue justifies committed-use pricing.
- One media vendor (Cloudflare R2 + Stream) shared across web and mobile — no duplicate storage/egress billing for the same content library.
- Push heavy/video bandwidth costs to the CDN layer (Cloudflare's edge), not through your own API servers — never proxy large media through a serverless function; R2 has zero egress fees, which materially caps the biggest line item (video/image delivery) as DAU scales.

| Cost driver | Optimization |
|---|---|
| Cloudflare R2 storage/requests | No egress fees (R2's key advantage over S3/Cloudinary); use lifecycle rules to auto-delete expired Stories objects rather than a cron sweep |
| Cloudflare Stream | Priced per minute stored + minute delivered; transcode once at upload (Stream handles this automatically) rather than re-encoding on the fly |
| Supabase compute | Start on a single shared Postgres instance; add read replica only when feed-read latency degrades, not preemptively |
| Paystack fees | These are pass-through to users/creators by design (deduct at settlement) — not a platform cost to optimize, but disclose clearly to avoid support load |
| Live streaming (Phase 3) | Cloudflare Stream Live bills per-minute viewed; no dedicated media servers to provision pre-demand |
| Push notifications | Free at Expo's tier for MVP volume; monitor for migration to FCM/APNs direct only if Expo's service becomes a bottleneck at scale |
| Moderation API calls | Batch/async hash-scanning rather than synchronous on upload, to avoid paying for redundant re-scans on edits |
| Background jobs | Use Supabase's built-in `pg_cron` (no extra vendor) before adopting a paid queue service |
| Error/analytics tooling | Single Sentry + single PostHog project shared across web and mobile clients (tag by platform) rather than separate paid tiers per client |

**Rule of thumb for early-stage cost control:** even with R2/Stream confirmed, keep the media layer behind a `MediaProvider` interface in code (already true of the web app's R2 usage) so a future vendor renegotiation is a contained change, not a rewrite.

---

## Open Decisions for Founder/CTO Sign-off

1. **Platform fee %** — finalize per revenue stream (suggested ranges in §7).
2. **Payout hold period** — balance fraud/chargeback protection vs. creator cash-flow expectations (3 days suggested default).
3. **KYC vendor** — manual review (MVP) vs. Smile Identity/similar automated NG identity verification (Phase 3).
4. **Live streaming rollout timing** — confirm Phase 2 vs Phase 3 for Cloudflare Stream Live, based on creator demand signal post-launch.
