"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/operations/navigation";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stone-200 bg-surface md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-stone-200 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          CD
        </span>
        <span className="text-base font-semibold text-stone-900">
          {APP_NAME}
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
