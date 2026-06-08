"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type VaultResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateVault(username?: string) {
  revalidatePath("/creator/vault");
  revalidatePath("/creator/content");
  if (username) revalidatePath(`/creators/${username}`);
}

export async function createCategory(input: {
  name: string;
  description?: string;
}): Promise<VaultResult<{ categoryId: string }>> {
  const name = input.name.trim();
  if (!name) return { success: false, error: "Category name is required." };
  if (name.length > 100) return { success: false, error: "Name is too long." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data, error } = await supabase
    .from("post_categories")
    .insert({
      creator_id: auth.userId,
      name,
      description: input.description?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You already have a category with that name." };
    }
    return { success: false, error: error.message };
  }

  revalidateVault(auth.profile.username);
  return { success: true, data: { categoryId: data.id } };
}

export async function updateCategory(input: {
  categoryId: string;
  name?: string;
  description?: string;
  sortOrder?: number;
}): Promise<VaultResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { success: false, error: "Name is required." };
    payload.name = name;
  }
  if (input.description !== undefined) {
    payload.description = input.description.trim() || null;
  }
  if (input.sortOrder !== undefined) {
    payload.sort_order = input.sortOrder;
  }

  const { error } = await supabase
    .from("post_categories")
    .update(payload)
    .eq("id", input.categoryId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidateVault(auth.profile.username);
  return { success: true };
}

export async function deleteCategory(categoryId: string): Promise<VaultResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("post_categories")
    .delete()
    .eq("id", categoryId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidateVault(auth.profile.username);
  return { success: true };
}

const MAX_CATEGORIES_PER_POST = 20;

/** Replaces all category assignments for a post with the given set. */
export async function setPostCategories(input: {
  postId: string;
  categoryIds: string[];
}): Promise<VaultResult> {
  if (!Array.isArray(input.categoryIds)) {
    return { success: false, error: "Invalid category list." };
  }
  if (input.categoryIds.length > MAX_CATEGORIES_PER_POST) {
    return { success: false, error: `Maximum ${MAX_CATEGORIES_PER_POST} categories per post.` };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  // Verify post belongs to creator
  const { data: post } = await supabase
    .from("posts")
    .select("id")
    .eq("id", input.postId)
    .eq("creator_id", auth.userId)
    .maybeSingle();

  if (!post) return { success: false, error: "Post not found." };

  // Remove old assignments, insert new ones
  await supabase
    .from("post_category_assignments")
    .delete()
    .eq("post_id", input.postId);

  if (input.categoryIds.length > 0) {
    const { error } = await supabase
      .from("post_category_assignments")
      .insert(
        input.categoryIds.map((categoryId) => ({
          post_id: input.postId,
          category_id: categoryId,
        })),
      );
    if (error) return { success: false, error: error.message };
  }

  revalidateVault(auth.profile.username);
  return { success: true };
}
