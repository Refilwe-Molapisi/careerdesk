"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/operations/navigation";
import { cn } from "@/lib/utils";

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-surface md:hidden"
      aria-label="Main navigation"
    >
      <div className="grid auto-cols-fr grid-flow-col">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-2 text-[10px] font-medium transition-colors",
                active ? "text-accent" : "text-stone-500 hover:text-stone-800",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="w-full truncate text-center leading-tight">
                {item.label === "Career Record" ? "Record" : item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
