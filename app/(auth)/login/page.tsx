import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/data/supabase/server";
import { hasSupabaseEnv } from "@/lib/data/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

// Never prerender this page: it reads the auth session, and a deployment
// without configuration must render the setup screen instead of failing.
export const dynamic = "force-dynamic";

function SetupScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
            CD
          </span>
          <h1 className="text-xl font-semibold text-stone-900">Career Desk</h1>
        </div>

        <div className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden />
            Setup required
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            The app is deployed but its Supabase environment variables are not
            set, so there is nothing to sign in to yet. Set them in Vercel
            (Project &rarr; Settings &rarr; Environment Variables), then
            redeploy:
          </p>
          <ul className="mt-3 space-y-1 rounded-lg bg-stone-50 px-3 py-2.5 font-mono text-xs text-stone-700">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Both values are in your Supabase project under Project Settings
            &rarr; API. Full steps are in the README under &ldquo;Deploying to
            Vercel&rdquo;.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // A deployment without configuration shows a clear setup screen instead
  // of crashing.
  if (!hasSupabaseEnv()) {
    return <SetupScreen />;
  }

  // Signed-in users never see the login page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
          CD
        </span>
        <h1 className="text-xl font-semibold text-stone-900">Career Desk</h1>
        <p className="text-sm text-stone-500">
          Your private remote-job search workspace
        </p>
      </div>

      <div className="card w-full max-w-sm p-6">
        <LoginForm authError={error === "auth"} />
      </div>

      <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-stone-400">
        Private, single-user app. Access is limited to the owner account.
      </p>
    </div>
  );
}
