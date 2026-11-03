import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline",
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <WifiOff className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-stone-900">You are offline</h1>
      <p className="max-w-md text-sm leading-relaxed text-stone-500">
        Career Desk needs a connection to reach your data. Reconnect and try
        again. Installed on your device, the app will open normally; nothing
        was lost.
      </p>
    </div>
  );
}
