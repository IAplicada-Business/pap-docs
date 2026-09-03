import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART_COLORS = {
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-destructive)",
  muted: "var(--color-muted-foreground)",
  chart4: "var(--color-chart-4)",
  chart5: "var(--color-chart-5)",
};

function TooltipBox({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: Record<string, unknown> }[];
  label?: string | number;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-card/85 px-3 py-2 text-xs shadow-elevated backdrop-blur-xl">
      {label != null && <div className="mb-1 font-semibold">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">
            {formatter ? formatter(p.value ?? 0) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({
  data,
  color = CHART_COLORS.primary,
}: {
  data: number[];
  color?: string;
}) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type Series = { key: string; label: string; color: string };

export function AreaTrend({
  data,
  xKey,
  series,
  height = 220,
  formatter,
  stacked,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: number;
  formatter?: (v: number) => string;
  stacked?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            allowDecimals={false}
            width={44}
          />
          <Tooltip
            content={<TooltipBox {...(formatter ? { formatter } : {})} />}
            cursor={{ stroke: "var(--color-border)" }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              {...(stacked ? { stackId: "a" } : {})}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({
  data,
  xKey,
  series,
  height = 220,
  formatter,
  stacked,
  horizontal,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  height?: number;
  formatter?: (v: number) => string;
  stacked?: boolean;
  horizontal?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -18 }}
          barCategoryGap={horizontal ? 6 : 12}
        >
          <CartesianGrid
            vertical={!!horizontal}
            horizontal={!horizontal}
            stroke="var(--color-border)"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                width={110}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                allowDecimals={false}
                width={44}
              />
            </>
          )}
          <Tooltip
            content={<TooltipBox {...(formatter ? { formatter } : {})} />}
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              {...(stacked ? { stackId: "a" } : {})}
              radius={stacked && i < series.length - 1 ? 0 : 4}
              maxBarSize={horizontal ? 14 : 28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type DonutSlice = { name: string; value: number; color: string };

export function Donut({
  data,
  size = 160,
  thickness = 18,
  center,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  center?: { value: string; label: string };
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const rows = total > 0 ? data : [{ name: "Sem dados", value: 1, color: "var(--color-muted)" }];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={size / 2 - thickness}
            outerRadius={size / 2}
            paddingAngle={total > 0 ? 2 : 0}
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {rows.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {total > 0 && <Tooltip content={<TooltipBox />} />}
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold leading-none tabular-nums">{center.value}</span>
          <span className="mt-1 text-[0.6875rem] text-muted-foreground">{center.label}</span>
        </div>
      )}
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { name: string; value: number | string; color: string }[];
}) {
  return (
    <ul className="grid gap-1.5 text-xs">
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: it.color }} />
          <span className="truncate text-muted-foreground">{it.name}</span>
          <span className="ml-auto font-semibold tabular-nums">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}
