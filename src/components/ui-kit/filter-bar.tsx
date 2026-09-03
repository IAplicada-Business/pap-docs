import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function FilterBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 rounded-xl border-border/40 bg-card/60 pl-8 text-[0.8125rem] backdrop-blur-sm transition-all focus:border-primary/30 focus:bg-card/80"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Limpar"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

export type Chip = { key: string; label: string; onRemove: () => void };

export function ActiveChips({ chips, onClear }: { chips: Chip[]; onClear?: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-lg bg-primary/8 px-2 py-1 text-[0.6875rem] font-medium text-primary ring-1 ring-primary/10 backdrop-blur-sm"
        >
          {c.label}
          <button
            type="button"
            onClick={c.onRemove}
            className="rounded hover:bg-primary/15"
            aria-label={`Remover ${c.label}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {onClear && chips.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground"
        >
          Limpar tudo
        </button>
      )}
    </div>
  );
}
