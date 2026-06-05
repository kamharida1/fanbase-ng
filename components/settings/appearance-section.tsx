"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AppearanceSection() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="max-w-md space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <div>
          <Label htmlFor="dark-mode" className="text-sm font-normal">
            Dark mode
          </Label>
          <p className="text-xs text-muted-foreground">
            Switch between light and dark theme.
          </p>
        </div>
        {mounted ? (
          <Switch
            id="dark-mode"
            checked={resolvedTheme === "dark"}
            onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
          />
        ) : (
          <div className="h-5 w-9 rounded-full bg-input" />
        )}
      </div>
    </div>
  );
}
