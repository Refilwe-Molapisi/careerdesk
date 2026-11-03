import type { Metadata } from "next";
import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { APP_NAME, APP_VERSION } from "@/lib/config";
import { InstallAppCard } from "./install-app-card";
import { SignOutCard } from "./sign-out-card";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const { user } = await requireUser();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account, workspace preferences and app data."
      />

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">
            Account
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <dt className="w-40 shrink-0 text-stone-500">Signed in as</dt>
              <dd className="font-medium text-stone-900">{user.email}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <dt className="w-40 shrink-0 text-stone-500">User ID</dt>
              <dd className="font-mono text-xs text-stone-600">{user.id}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-stone-900">
            Workspace
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <dt className="w-40 shrink-0 text-stone-500">App name</dt>
              <dd className="font-medium text-stone-900">{APP_NAME}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <dt className="w-40 shrink-0 text-stone-500">Version</dt>
              <dd className="font-medium text-stone-900">{APP_VERSION}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
              <dt className="w-40 shrink-0 text-stone-500">Analytics</dt>
              <dd className="font-medium text-stone-900">
                None. No trackers, no third-party scripts.
              </dd>
            </div>
          </dl>
        </section>

        <InstallAppCard />

        <SignOutCard />
      </div>
    </>
  );
}
