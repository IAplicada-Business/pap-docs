import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "./page-header";
import { Sparkline } from "./charts";

export type KpiTone = "primary" | "accent" | "success" | "warning" | "danger" | "neutral";

const TONES: Record<KpiTone, { icon: string; bar: string; line: string }> = {
  primary: { icon: "bg-primary/10 text-primary", bar: "bg-primary", line: "var(--color-primary)" },
  accent: { icon: "bg-accent/10 text-accent", bar: "bg-accent", line: "var(--color-accent)" },
  success: { icon: "bg-success/10 text-success", bar: "bg-success", line: "var(--color-success)" },
  warning: {
    icon: "bg-warning/15 text-warning-foreground",
    bar: "bg-warning",
    line: "var(--color-warning)",
  },
  danger: {
    icon: "bg-destructive/10 text-destructive",
    bar: "bg-destructive",
    line: "var(--color-destructive)",
  },
  neutral: {
    icon: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground",
    line: "var(--color-muted-foreground)",
  },
};

type Props = {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: KpiTone;
  hint?: string;
  delta?: number | null;
  deltaLabel?: string;
  sparkline?: number[];
  progress?: number | null;
  footer?: ReactNode;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
};

// `icon` é aceito por compatibilidade, mas não é renderizado: títulos de KPI não levam ícone.
export function KpiCard({
  label,
  value,
  tone = "primary",
  hint,
  delta,
  deltaLabel,
  sparkline,
  progress,
  footer,
  loading,
  onClick,
  active,
}: Props) {
  const t = TONES[tone];
  const Wrapper: "button" | "div" = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`kpi-card group text-left ${onClick ? "cursor-pointer" : ""} ${active ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[0.75rem] font-medium text-muted-foreground">{label}</span>
        {hint && <InfoTip text={hint} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <div className="text-[1.5rem] font-bold leading-none tracking-tight tabular-nums">
              {value}
            </div>
          )}
          {(delta != null || deltaLabel) && !loading && (
            <div className="mt-1.5 flex items-center gap-1 text-[0.6875rem]">
              {delta != null && <Delta value={delta} />}
              {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && !loading && (
          <div className="h-8 w-20 shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
            <Sparkline data={sparkline} color={t.line} />
          </div>
        )}
      </div>
      {progress != null && !loading && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/10">
          <div
            className={`h-full rounded-full ${t.bar}`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {footer && <div className="mt-2 text-[0.6875rem] text-muted-foreground">{footer}</div>}
    </Wrapper>
  );
}

export function Delta({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold text-muted-foreground">
        <Minus className="size-3" /> 0{suffix}
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-success" : "text-destructive"}`}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {up ? "+" : ""}
      {value.toFixed(0)}
      {suffix}
    </span>
  );
}

export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const map = {
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 xl:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  } as const;
  return <div className={`grid gap-3 ${map[cols]}`}>{children}</div>;
}
