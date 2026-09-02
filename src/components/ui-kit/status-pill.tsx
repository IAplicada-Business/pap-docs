import { STATUS_COMPETENCIA, STATUS_LANCAMENTO, STATUS_PROCESSAMENTO } from "@/lib/dominio";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE: Record<Tone, { dot: string; wrap: string }> = {
  success: { dot: "bg-success", wrap: "bg-success/10 text-success" },
  warning: { dot: "bg-warning", wrap: "bg-warning/15 text-warning-foreground" },
  danger: { dot: "bg-destructive", wrap: "bg-destructive/10 text-destructive" },
  info: { dot: "bg-chart-4", wrap: "bg-chart-4/10 text-chart-4" },
  primary: { dot: "bg-primary", wrap: "bg-primary/10 text-primary" },
  neutral: { dot: "bg-muted-foreground/50", wrap: "bg-muted text-muted-foreground" },
};

export function StatusPill({
  tone,
  label,
  pulse,
  size = "sm",
}: {
  tone: Tone;
  label: string;
  pulse?: boolean;
  size?: "xs" | "sm";
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium ${t.wrap} ${
        size === "xs" ? "px-1.5 py-0.5 text-[0.6875rem]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={`size-1.5 rounded-full ${t.dot} ${pulse ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

export function toneDocumento(status: string): Tone {
  if (status === "processado") return "success";
  if (status === "erro") return "danger";
  if (status === "processando") return "warning";
  return "neutral";
}

export function pillDocumento(status: string, size?: "xs" | "sm") {
  return (
    <StatusPill
      tone={toneDocumento(status)}
      label={STATUS_PROCESSAMENTO[status] ?? status}
      pulse={status === "processando"}
      {...(size ? { size } : {})}
    />
  );
}

export function toneCompetencia(status: string): Tone {
  if (status === "fechada") return "neutral";
  if (status === "em_conciliacao") return "warning";
  return "success";
}

export function pillCompetencia(status: string, size?: "xs" | "sm") {
  return (
    <StatusPill
      tone={toneCompetencia(status)}
      label={STATUS_COMPETENCIA[status] ?? status}
      pulse={status === "em_conciliacao"}
      {...(size ? { size } : {})}
    />
  );
}

export function toneLancamento(status: string): Tone {
  if (status === "conciliado" || status === "revisado") return "success";
  if (status === "classificado") return "primary";
  return "warning";
}

export function pillLancamento(status: string, size?: "xs" | "sm") {
  return (
    <StatusPill
      tone={toneLancamento(status)}
      label={STATUS_LANCAMENTO[status] ?? status}
      {...(size ? { size } : {})}
    />
  );
}

export function ConfidenceBar({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value <= 1 ? value * 100 : value);
  const tone = pct >= 85 ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  height = "h-1.5",
}: {
  value: number;
  tone?: Tone;
  height?: string;
}) {
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-muted`}>
      <div
        className={`h-full rounded-full ${TONE[tone].dot} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Avatar({
  name,
  src,
  color,
  size = "md",
}: {
  name: string;
  src?: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm"
      ? "size-7 text-[0.625rem]"
      : size === "lg"
        ? "size-12 text-base"
        : "size-9 text-xs";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} shrink-0 rounded-lg border border-border bg-white object-contain p-0.5`}
      />
    );
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-lg font-bold text-white`}
      style={{ backgroundColor: color || "var(--color-primary)" }}
    >
      {initials || "?"}
    </span>
  );
}
