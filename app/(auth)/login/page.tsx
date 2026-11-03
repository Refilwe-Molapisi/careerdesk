import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/data/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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
