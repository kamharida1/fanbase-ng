const PROJECT_REF = "gghdwaildyjgmwhfdlun";
const API_SETTINGS_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api`;

export function getSupabasePublicConfig(): {
  url: string;
  anonKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      [
        "Missing Supabase configuration in .env.local.",
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart `npm run dev`.",
        `Get both values: ${API_SETTINGS_URL}`,
      ].join(" "),
    );
  }

  return { url, anonKey };
}
