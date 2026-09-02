import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  title: ReactNode;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions, children }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-[1.375rem] font-bold leading-tight tracking-tight">{title}</h1>
            {description && <InfoTip text={description} />}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Mais informações"
            className={`inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground ${className}`}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs bg-foreground text-background">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
