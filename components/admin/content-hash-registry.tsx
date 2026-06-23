"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDate } from "@/lib/admin/format";
import {
  deleteContentHash,
  importContentHashes,
  type ContentHashRow,
  type ContentHashStats,
} from "@/lib/admin/content-hash-actions";

const CATEGORY_LABELS: Record<string, string> = {
  csam: "CSAM",
  ncii: "NCII",
  violence: "Violence",
  spam: "Spam",
  other: "Other",
};

const SOURCE_LABELS: Record<string, string> = {
  ncmec: "NCMEC",
  stopncii: "StopNCII",
  internal: "Internal",
  manual: "Manual",
};

export function ContentHashRegistry({
  initialHashes,
  stats,
  isSuperAdmin,
}: {
  initialHashes: ContentHashRow[];
  stats: ContentHashStats;
  isSuperAdmin: boolean;
}) {
  const [hashes, setHashes] = useState(initialHashes);
  const [isPending, startTransition] = useTransition();

  // Import form state
  const [rawHashes, setRawHashes] = useState("");
  const [category, setCategory] = useState("csam");
  const [severity, setSeverity] = useState("critical");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [importMessage, setImportMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function handleImport() {
    setImportMessage(null);
    startTransition(async () => {
      const result = await importContentHashes({ rawHashes, category, severity, source, notes: notes || undefined });
      if (result.success) {
        setImportMessage({ type: "ok", text: `Imported ${result.imported} hash${result.imported === 1 ? "" : "es"}.` });
        setRawHashes("");
        setNotes("");
        // Optimistic: trigger a refresh via router is handled by revalidatePath in the action.
        // Re-fetch isn't done client-side; page revalidation covers it.
      } else {
        setImportMessage({ type: "err", text: result.error });
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteContentHash(id);
      if (result.success) {
        setHashes((prev) => prev.filter((h) => h.id !== id));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatBadge label="Total" value={stats.total} />
        {Object.entries(stats.by_category).map(([cat, count]) => (
          <StatBadge key={cat} label={CATEGORY_LABELS[cat] ?? cat} value={count} />
        ))}
        {stats.total === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Hash registry is empty — content scans will pass everything.
          </p>
        )}
      </div>

      {/* Import form */}
      <div className="rounded-xl border p-4 space-y-3">
        <h3 className="font-semibold text-sm">Import hashes</h3>
        <p className="text-xs text-muted-foreground">
          Paste SHA-256 hashes (64-character hex), one per line or comma-separated.
          Duplicates are silently skipped.
        </p>
        <Textarea
          placeholder={"a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2\n..."}
          rows={5}
          className="font-mono text-xs"
          value={rawHashes}
          onChange={(e) => setRawHashes(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Category</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Severity</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Source</span>
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Notes (optional)</span>
          <input
            className="h-8 rounded-md border bg-background px-3 text-xs"
            placeholder="e.g. NCMEC batch 2026-06"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </div>
        {importMessage && (
          <p className={`text-xs ${importMessage.type === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
            {importMessage.text}
          </p>
        )}
        <Button
          size="sm"
          disabled={isPending || !rawHashes.trim()}
          onClick={handleImport}
        >
          {isPending ? "Importing…" : "Import"}
        </Button>
      </div>

      {/* Hash table */}
      {hashes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">SHA-256</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-left font-medium">Added</th>
                {isSuperAdmin && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {hashes.map((h) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {h.sha256_hex.slice(0, 16)}…
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      h.category === "csam"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : h.category === "ncii"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {CATEGORY_LABELS[h.category] ?? h.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {SOURCE_LABELS[h.source] ?? h.source}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatAdminDate(h.created_at)}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-3 py-2">
                      <button
                        className="text-destructive hover:underline disabled:opacity-50"
                        disabled={isPending}
                        onClick={() => handleDelete(h.id)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-1.5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold tabular-nums">{value}</p>
    </div>
  );
}
