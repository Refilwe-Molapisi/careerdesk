import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Compass className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-stone-900">Page not found</h1>
      <p className="max-w-md text-sm text-stone-500">
        The page you are looking for does not exist or may have moved.
      </p>
      <Link href="/dashboard" className="btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}
