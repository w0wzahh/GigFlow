"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
} from "recharts";
import { useEffect, useState } from "react";

function useChartColors() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return {
    grid: dark ? "#262b33" : "#e2e4e9",
    tick: dark ? "#9aa1ae" : "#5c6270",
    accent: dark ? "#2ac4b8" : "#0b8a80",
    negative: dark ? "#eb6f5c" : "#c4402f",
    tooltipBg: dark ? "#14171c" : "#ffffff",
    tooltipBorder: dark ? "#3a414d" : "#e2e4e9",
  };
}

const tooltipStyle = (c: ReturnType<typeof useChartColors>) => ({
  contentStyle: {
    background: c.tooltipBg,
    border: `1px solid ${c.tooltipBorder}`,
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: c.tick },
});

export type SeriesPoint = {
  date: string;
  grossCents: number;
  expensesCents?: number;
  hours?: number;
  distanceKm?: number;
};

export function EarningsChart({
  data,
  money,
  height = 220,
}: {
  data: SeriesPoint[];
  money: (cents: number) => string;
  height?: number;
}) {
  const c = useChartColors();
  const chartData = data.map((d) => ({
    ...d,
    gross: d.grossCents / 100,
    expenses: (d.expensesCents ?? 0) / 100,
    net: (d.grossCents - (d.expensesCents ?? 0)) / 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: c.tick }}
          tickFormatter={(v: string) => v.slice(5)}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: c.tick }}
          tickFormatter={(v: number) => `$${v}`}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          {...tooltipStyle(c)}
          formatter={(v) => [money(Math.round(Number(v) * 100)), undefined]}
        />
        <Bar dataKey="expenses" name="Expenses" fill={c.negative} opacity={0.5} radius={[2, 2, 0, 0]} stackId="a" />
        <Line type="monotone" dataKey="gross" name="Gross" stroke={c.accent} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({
  data,
  dataKey = "grossCents",
  money,
  height = 160,
}: {
  data: SeriesPoint[];
  dataKey?: keyof SeriesPoint;
  money: (cents: number) => string;
  height?: number;
}) {
  const c = useChartColors();
  const chartData = data.map((d) => ({ ...d, v: Number(d[dataKey] ?? 0) / 100 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.accent} stopOpacity={0.25} />
            <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: c.tick }} tickFormatter={(v: string) => v.slice(5)} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: c.tick }} tickFormatter={(v: number) => `$${v}`} tickLine={false} axisLine={false} width={48} />
        <Tooltip {...tooltipStyle(c)} formatter={(v) => [money(Math.round(Number(v) * 100)), ""]} />
        <Area type="monotone" dataKey="v" stroke={c.accent} strokeWidth={2} fill="url(#gf)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PlatformDonut({
  data,
  money,
  height = 200,
}: {
  data: { name: string; color: string; grossCents: number }[];
  money: (cents: number) => string;
  height?: number;
}) {
  const chartData = data.map((d) => ({ ...d, value: d.grossCents / 100 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={0}
        >
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [money(Math.round(Number(v) * 100)), name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MiniBars({
  data,
  money,
  height = 140,
}: {
  data: SeriesPoint[];
  money: (cents: number) => string;
  height?: number;
}) {
  const c = useChartColors();
  const chartData = data.map((d) => ({ ...d, v: d.grossCents / 100 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: c.tick }} tickFormatter={(v: string) => v.slice(5)} tickLine={false} axisLine={{ stroke: c.grid }} />
        <YAxis tick={{ fontSize: 11, fill: c.tick }} tickFormatter={(v: number) => `$${v}`} tickLine={false} axisLine={false} width={44} />
        <Tooltip {...tooltipStyle(c)} formatter={(v) => [money(Math.round(Number(v) * 100)), "Gross"]} />
        <Bar dataKey="v" fill={c.accent} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
