import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-background px-4 py-10 sm:px-6 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.68 0.15 231 / 0.25), transparent)",
        }}
      />
      <Card className="w-full min-w-0 max-w-md border-border/60 shadow-xl shadow-black/20">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-primary">Fanbase NG</CardTitle>
          <CardDescription>Nigerian creator subscriptions</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
