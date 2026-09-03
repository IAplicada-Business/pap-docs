import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./section-card";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  width?: string;
  align?: "left" | "right" | "center";
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

const HIDE = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  emptyTitle = "Nada por aqui",
  emptyHint,
  emptyAction,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  defaultSort,
  dense,
  maxHeight,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  dense?: boolean;
  maxHeight?: number | string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    defaultSort ?? null,
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const r =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR");
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected?.has(rowKey(r)));
  const someSelected = selectable && rows.some((r) => selected?.has(rowKey(r)));

  function toggleAll() {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (allSelected) rows.forEach((r) => next.delete(rowKey(r)));
    else rows.forEach((r) => next.add(rowKey(r)));
    onSelectedChange(next);
  }

  function toggleOne(k: string) {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectedChange(next);
  }

  const py = dense ? "py-2" : "py-2.5";

  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-[0.8125rem]">
        <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur-lg">
          <tr>
            {selectable && (
              <th className="w-9 border-b border-border/60 px-3 py-2">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
            )}
            {columns.map((c) => {
              const sortable = !!c.sortValue;
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={`border-b border-border/60 px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground ${ALIGN[c.align ?? "left"]} ${c.hideBelow ? HIDE[c.hideBelow] : ""}`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key
                            ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                            : { key: c.key, dir: "asc" },
                        )
                      }
                      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
                    >
                      {c.header}
                      {active ? (
                        sort?.dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {selectable && (
                  <td className={`px-3 ${py}`}>
                    <Skeleton className="size-4" />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 ${py} ${c.hideBelow ? HIDE[c.hideBelow] : ""}`}>
                    <Skeleton className="h-4 w-full max-w-40" />
                  </td>
                ))}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                <EmptyState
                  icon={Inbox}
                  title={emptyTitle}
                  {...(emptyHint ? { hint: emptyHint } : {})}
                  {...(emptyAction ? { action: emptyAction } : {})}
                  compact
                />
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const k = rowKey(row);
              const isSel = selected?.has(k);
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`group transition-colors ${onRowClick ? "cursor-pointer" : ""} ${isSel ? "bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  {selectable && (
                    <td
                      className={`border-b border-border/40 px-3 ${py}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={!!isSel}
                        onCheckedChange={() => toggleOne(k)}
                        aria-label="Selecionar"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`border-b border-border/40 px-3 ${py} align-middle ${ALIGN[c.align ?? "left"]} ${c.hideBelow ? HIDE[c.hideBelow] : ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
