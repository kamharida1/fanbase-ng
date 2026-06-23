import { ContentHashRegistry } from "@/components/admin/content-hash-registry";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import { StalePostsBacklog } from "@/components/admin/stale-posts-backlog";
import { getContentHashStats, listContentHashes } from "@/lib/admin/content-hash-actions";
import {
  countStalePendingPublishedPosts,
  listModerationQueue,
} from "@/lib/moderation";
import { createStaffAdminClient } from "@/lib/admin/server";
import { requireAdminStaff } from "@/lib/admin/require";

export default async function AdminModerationPage() {
  const [auth, admin] = await Promise.all([
    requireAdminStaff("admin"),
    createStaffAdminClient(),
  ]);

  const [items, staleCount, hashes, hashStats] = await Promise.all([
    listModerationQueue(admin, 50),
    countStalePendingPublishedPosts(admin),
    listContentHashes(),
    getContentHashStats(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Content review</h1>
        <p className="mt-2 text-muted-foreground">
          Review flagged content and manage the hash registry used for automated
          CSAM and NCII detection.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Moderation queue</h2>
        <StalePostsBacklog count={staleCount} />
        <ModerationPanel items={items} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Hash registry</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SHA-256 hashes of known illegal content (CSAM, NCII). Any upload
            matching a hash is blocked immediately and the uploader&apos;s account
            is suspended for CSAM matches. Obtain hash sets from{" "}
            <a
              href="https://www.missingkids.org/gethelpnow/ncmec-cybertipline"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              NCMEC
            </a>{" "}
            or{" "}
            <a
              href="https://stopncii.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              StopNCII
            </a>
            .
          </p>
        </div>
        <ContentHashRegistry
          initialHashes={hashes}
          stats={hashStats}
          isSuperAdmin={auth.appRole === "super_admin"}
        />
      </section>
    </div>
  );
}
