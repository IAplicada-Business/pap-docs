import { STATUS_PROCESSAMENTO } from "@/lib/dominio";

export function badgeStatus(status: string) {
  const config: Record<string, { dot: string; bg: string; text: string }> = {
    processado: {
      dot: "bg-success",
      bg: "bg-success/10",
      text: "text-success",
    },
    erro: {
      dot: "bg-destructive",
      bg: "bg-destructive/10",
      text: "text-destructive",
    },
    processando: {
      dot: "bg-warning animate-pulse",
      bg: "bg-warning/10",
      text: "text-warning-foreground",
    },
  };

  const c = config[status] ?? {
    dot: "bg-muted-foreground/50",
    bg: "bg-secondary",
    text: "text-secondary-foreground",
  };

  return (
    <span className={`status-dot ${c.bg} ${c.text}`}>
      <span className={`size-1.5 rounded-full ${c.dot}`} />
      {STATUS_PROCESSAMENTO[status] ?? status}
    </span>
  );
}
