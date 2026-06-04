import { cn } from "@/lib/utils";

type SpinnerProps = { className?: string; size?: "sm" | "md" | "lg" };

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClass = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" }[size];
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground",
        sizeClass,
        className,
      )}
    />
  );
}

export function SpinnerPage() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
