"use client";

import { MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import {
  getPromptEvent,
  useInstallState,
} from "@/components/pwa/install-prompt-store";

export function InstallAppCard() {
  const { canInstall, installed } = useInstallState();

  async function install() {
    const event = getPromptEvent();
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      toast.success("Career Desk was installed.");
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-base font-semibold text-stone-900">
        Install app
      </h2>
      <p className="mb-4 text-sm text-stone-500">
        Install Career Desk on this device for its own window, an app icon and
        offline access to the shell.
      </p>

      {installed ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Career Desk is installed on this device.
        </p>
      ) : canInstall ? (
        <button onClick={install} className="btn-primary">
          <MonitorSmartphone className="h-4 w-4" aria-hidden />
          Install Career Desk
        </button>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs leading-relaxed text-stone-600">
          <p className="font-medium text-stone-700">
            Use your browser menu to install:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              <span className="font-medium">Chrome (desktop):</span> install
              icon in the address bar, or Menu → Cast, save and share → Install
              page as app.
            </li>
            <li>
              <span className="font-medium">Chrome (Android):</span> menu ⋮ →
              Add to Home screen → Install.
            </li>
            <li>
              <span className="font-medium">Safari (iPhone/iPad):</span> Share
              button → Add to Home Screen.
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
