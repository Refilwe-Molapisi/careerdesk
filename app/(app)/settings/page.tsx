import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/data/auth";
import { getUserSettings } from "@/lib/data/queries/career";
import { APP_NAME, APP_VERSION, DEFAULT_BANNED_PHRASES } from "@/lib/config";
import { BannedPhrasesCard } from "./banned-phrases-card";
import { ProfileCard } from "./profile-card";
import { RemindersCard } from "./reminders-card";
import { InstallAppCard } from "./install-app-card";
import { SignOutCard } from "./sign-out-card";
import { DataCard } from "@/components/settings/data-card";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();

  let settings: Awaited<ReturnType<typeof getUserSettings>> = null;
  try {
    settings = await getUserSettings(supabase, user.id);
  } catch {
    // Table may not exist yet (migration not run): fall back to defaults.
  }

  const bannedPhrases = settings?.banned_phrases ?? [...DEFAULT_BANNED_PHRASES];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account, workspace preferences and app data."
      />

      <div className="space-y-4">
        <ProfileCard
          userId={user.id}
          email={user.email ?? null}
          initialFullName={settings?.full_name ?? ""}
          initialMinimumSalary={settings?.minimum_salary?.toString() ?? ""}
          initialMinimumSalaryCurrency={settings?.minimum_salary_currency ?? ""}
          initialMonthlyCap={settings?.monthly_cap_usd?.toString() ?? ""}
          initialRetentionDays={settings?.recording_retention_days?.toString() ?? ""}
        />

        <BannedPhrasesCard userId={user.id} initialPhrases={bannedPhrases} />

        <RemindersCard
          userId={user.id}
          initialEmail={settings?.reminder_email ?? ""}
          initialEnabled={settings?.reminders_enabled ?? false}
          fallbackEmail={user.email ?? ""}
        />

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

        <DataCard email={user.email ?? null} />

        <SignOutCard />
      </div>
    </>
  );
}
