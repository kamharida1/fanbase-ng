export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number]["value"];

export const CREATOR_CATEGORIES = [
  { value: "music",     label: "Music & Entertainment", emoji: "🎵" },
  { value: "comedy",    label: "Comedy & Skits",        emoji: "😂" },
  { value: "fashion",   label: "Fashion & Style",       emoji: "👗" },
  { value: "fitness",   label: "Fitness & Wellness",    emoji: "💪" },
  { value: "food",      label: "Food & Cooking",        emoji: "🍲" },
  { value: "lifestyle", label: "Lifestyle",             emoji: "✨" },
  { value: "education", label: "Education",             emoji: "📚" },
  { value: "sports",    label: "Sports",                emoji: "⚽" },
  { value: "art",       label: "Art & Photography",     emoji: "🎨" },
  { value: "business",  label: "Business & Finance",    emoji: "💼" },
  { value: "travel",    label: "Travel",                emoji: "✈️" },
  { value: "gaming",    label: "Gaming",                emoji: "🎮" },
] as const;

export const CATEGORY_MAP = new Map(
  CREATOR_CATEGORIES.map((c) => [c.value, c]),
);

export const MAX_CATEGORIES = 3;
