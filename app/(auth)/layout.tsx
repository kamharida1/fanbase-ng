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
    <div className="flex min-h-screen items-center justify-center overflow-x-clip px-4 py-10 sm:px-6 sm:py-12">
      <Card className="w-full min-w-0 max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Fanbase NG</CardTitle>
          <CardDescription>Nigerian creator subscriptions</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
