"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil, Trash2, Check, X } from "lucide-react";

import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/vault/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoryRow } from "@/lib/vault/queries";

type Props = { categories: CategoryRow[] };

export function CategoryManager({ categories }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setError(null);
    setLoading(true);
    const result = await createCategory({ name: newName, description: newDesc });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setCreating(false);
    setNewName("");
    setNewDesc("");
    router.refresh();
  }

  function startEdit(cat: CategoryRow) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
  }

  async function handleUpdate(categoryId: string) {
    setError(null);
    setLoading(true);
    const result = await updateCategory({ categoryId, name: editName, description: editDesc });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(categoryId: string, name: string) {
    if (!confirm(`Delete "${name}"? Posts won't be deleted, just removed from this collection.`)) return;
    setLoading(true);
    await deleteCategory(categoryId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Existing categories */}
      {categories.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {categories.map((cat) => (
            <li key={cat.id} className="p-4">
              {editingId === cat.id ? (
                <div className="space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Collection name"
                    maxLength={100}
                  />
                  <Input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={loading} onClick={() => handleUpdate(cat.id)}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{cat.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {cat.post_count} post{cat.post_count !== 1 ? "s" : ""}
                      {cat.description ? ` · ${cat.description}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(cat)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(cat.id, cat.name)}
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Create new */}
      {creating ? (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Collection name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Workout Videos, BTS Photos…"
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="What's in this collection?"
              maxLength={500}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={loading || !newName.trim()} onClick={handleCreate}>
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => setCreating(true)}>
          <FolderPlus className="h-4 w-4" />
          New collection
        </Button>
      )}
    </div>
  );
}
