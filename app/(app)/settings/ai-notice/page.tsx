import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "AI data notice",
};

/**
 * Plain-language AI data notice (Prompt 24): what is sent to which service,
 * when, and what is never sent.
 */
export default function AiNoticePage() {
  return (
    <>
      <PageHeader
        title="AI data notice"
        description="Plain language, no legalese. This page lists exactly what leaves the app."
      />
      <div className="space-y-4">
        <section className="card p-5 text-sm leading-relaxed text-stone-700">
          <h2 className="text-base font-semibold text-stone-900">What is sent to DeepSeek (text AI)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>When you extract a job: the pasted job description.</li>
            <li>When you import a CV: the pasted CV text.</li>
            <li>When you tailor: the job description and only the career entries you allowed for that job (never the whole record).</li>
            <li>When you assess skills: your skill names, levels and evidence descriptions.</li>
            <li>When you check eligibility: the posting text and, if you saved a link, the public page text the server fetched.</li>
            <li>When you ask for changes: the part being changed and the entries behind it.</li>
          </ul>
        </section>
        <section className="card p-5 text-sm leading-relaxed text-stone-700">
          <h2 className="text-base font-semibold text-stone-900">What is sent to Deepgram (speech AI)</h2>
          <p className="mt-2">
            Nothing yet. Interview practice audio arrives in a later stage of
            the build, will be off by default, and will be your decision each
            time.
          </p>
        </section>
        <section className="card p-5 text-sm leading-relaxed text-stone-700">
          <h2 className="text-base font-semibold text-stone-900">What is never sent</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your password or sign-in email.</li>
            <li>Your South African ID number, home address or bank details.</li>
            <li>Other users&apos; data (the app is single-user, and every query is scoped to your account).</li>
            <li>Whole-record dumps: each AI call fetches only the entries relevant to the task.</li>
          </ul>
        </section>
        <section className="card p-5 text-sm leading-relaxed text-stone-700">
          <h2 className="text-base font-semibold text-stone-900">What the services return</h2>
          <p className="mt-2">
            Only text. Every return is validated in code against your record
            before you see it, and nothing changes your data without your
            approval. Prompt content is never logged; the log carries task
            name, duration and token counts.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            See <Link href="/usage" className="text-accent hover:underline">Usage</Link> for what
            the services cost, and{" "}
            <Link href="/settings" className="text-accent hover:underline">Settings</Link> for
            export and deletion. {APP_NAME} also sends your reminder email
            through Resend when there is something due.
          </p>
        </section>
      </div>
    </>
  );
}
