import { formatNgnFromKobo } from "@/lib/creators/format";

export function formatAdminMoney(kobo: number): string {
  return formatNgnFromKobo(kobo);
}

export function formatAdminDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
