"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/data/supabase/browser";

export function SignOutCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Session</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          Sign out of Career Desk on this device.
        </p>
      </div>
      <button onClick={signOut} disabled={busy} className="btn-outline">
        <LogOut className="h-4 w-4" aria-hidden />
        {busy ? "Signing out..." : "Sign out"}
      </button>
    </section>
  );
}
