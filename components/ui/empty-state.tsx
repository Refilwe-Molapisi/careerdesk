import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-stone-500">
          {description}
        </p>
      </div>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
