import type { ReactNode } from "react";
import { requireUser } from "@/lib/data/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Route protection in depth: the proxy guards requests, this guards pages.
  await requireUser();

  return <AppShell>{children}</AppShell>;
}
