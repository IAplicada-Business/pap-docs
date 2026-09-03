import type { ComponentType, ReactNode } from "react";

export type SubTabItem<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number | null;
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "danger" | "warning" | "success";
};

const COUNT_TONE = {
  default: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/15 text-warning-foreground",
  success: "bg-success/10 text-success",
};

export function SubTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: {
  items: SubTabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`-mb-px flex gap-1 overflow-x-auto border-b border-border/40 ${className}`}
      role="tablist"
    >
      {items.map(({ value: v, label, count, icon: Icon, tone = "default" }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[0.8125rem] font-medium transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="size-3.5" />}
            {label}
            {count != null && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums ${active ? "bg-primary/10 text-primary" : COUNT_TONE[tone]}`}
              >
                {count}
              </span>
            )}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary via-primary to-primary/40" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = "sm",
}: {
  items: { value: T; label: ReactNode; icon?: ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (v: T) => void;
  size?: "xs" | "sm";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl bg-muted/50 p-0.5 ring-1 ring-border/30 backdrop-blur-sm">
      {items.map(({ value: v, label, icon: Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-center gap-1.5 rounded-lg font-medium transition-all ${
              size === "xs" ? "px-2 py-1 text-[0.6875rem]" : "px-2.5 py-1.5 text-xs"
            } ${active ? "bg-card/80 text-foreground shadow-sm backdrop-blur-sm ring-1 ring-border/20" : "text-muted-foreground hover:text-foreground"}`}
          >
            {Icon && <Icon className="size-3.5" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
