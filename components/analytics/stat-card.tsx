import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  className?: string;
};

export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
