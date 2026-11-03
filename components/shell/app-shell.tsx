import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";
import { Sidebar } from "./sidebar";
import { BottomTabs } from "./bottom-tabs";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />

      <div className="md:pl-60">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2.5 border-b border-stone-200 bg-surface/95 px-4 backdrop-blur md:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
            CD
          </span>
          <span className="text-sm font-semibold text-stone-900">
            {APP_NAME}
          </span>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      <BottomTabs />
    </div>
  );
}
