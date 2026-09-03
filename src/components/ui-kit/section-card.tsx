import type { ComponentType, ReactNode } from "react";
import { InfoTip } from "./page-header";

type Props = {
  title?: ReactNode;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  dense?: boolean;
};

// `icon` é aceito por compatibilidade, mas não é renderizado: títulos de card não levam ícone.
export function SectionCard({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "",
  flush,
  dense,
}: Props) {
  return (
    <section className={`section-card ${className}`}>
      {(title || actions) && (
        <header
          className={`flex items-center justify-between gap-3 ${dense ? "px-4 py-2.5" : "px-5 py-3.5"}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {title && (
              <h2 className="truncate text-[0.8125rem] font-semibold tracking-tight">{title}</h2>
            )}
            {description && <InfoTip text={description} />}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div
        className={`${flush ? "" : dense ? "px-4 pb-4" : "px-5 pb-5"} ${!title && !actions && !flush ? (dense ? "pt-4" : "pt-5") : ""} ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  compact,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"}`}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground/60">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
