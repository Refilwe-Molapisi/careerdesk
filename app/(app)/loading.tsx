export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-stone-200" />
        <div className="h-4 w-72 rounded-lg bg-stone-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-xl bg-stone-100" />
        <div className="h-28 rounded-xl bg-stone-100" />
        <div className="h-28 rounded-xl bg-stone-100" />
      </div>
      <div className="h-48 rounded-xl bg-stone-100" />
    </div>
  );
}
