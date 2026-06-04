/**
 * Sanitize user input used in PostgREST `.or()` / `.ilike` filters.
 * Commas and parentheses break filter syntax; % and _ are wildcards.
 */
export function sanitizePostgrestIlikeTerm(raw: string): string | null {
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return null;

  const safe = trimmed.replace(/[^a-zA-Z0-9\s\-_@.]/g, "").trim();
  if (!safe) return null;

  return safe.replace(/[%_\\]/g, "");
}

export function postgrestIlikePattern(term: string): string {
  const safe = sanitizePostgrestIlikeTerm(term);
  if (!safe) return "%";
  return `%${safe}%`;
}
