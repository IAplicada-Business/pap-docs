import { Badge } from "@/components/ui/badge";
import { STATUS_PROCESSAMENTO } from "@/lib/dominio";

export function badgeStatus(status: string) {
  const cor =
    status === "processado"
      ? "bg-success/15 text-success"
      : status === "erro"
        ? "bg-destructive/15 text-destructive"
        : status === "processando"
          ? "bg-warning/20 text-warning-foreground"
          : "bg-secondary text-secondary-foreground";
  return (
    <Badge variant="secondary" className={cor}>
      {STATUS_PROCESSAMENTO[status] ?? status}
    </Badge>
  );
}
