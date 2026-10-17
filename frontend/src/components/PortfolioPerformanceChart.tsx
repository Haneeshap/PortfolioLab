"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Snapshot = {
  capturedAt: string;
  totalValue: number;
  cashBalance: number;
  holdingsValue: number;
  currency: string;
  valuationSource: string;
};

type Range = "1H" | "6H" | "1D" | "1W" | "ALL";

const ranges: { label: Range; milliseconds: number | null }[] = [
  { label: "1H", milliseconds: 60 * 60 * 1000 },
  { label: "6H", milliseconds: 6 * 60 * 60 * 1000 },
  { label: "1D", milliseconds: 24 * 60 * 60 * 1000 },
  { label: "1W", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { label: "ALL", milliseconds: null },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function PortfolioPerformanceChart({}: {
  value: number;
  ready: boolean;
}) {
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [range, setRange] = useState<Range>("1H");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/portfolio/history", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("History API unavailable");
        }

        const result: Snapshot[] = await response.json();

        if (active) {
          setHistory(result);
          setNow(Date.now());
          setError(null);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load history"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    const interval = setInterval(() => {
      void load();
    }, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const selectedRange = ranges.find((item) => item.label === range)!;

  const chartData = useMemo(() => {
    const cutoff =
      selectedRange.milliseconds === null
        ? null
        : now - selectedRange.milliseconds;

    return history
      .map((item) => ({
        time: new Date(item.capturedAt).getTime(),
        value: Number(item.totalValue),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.time) &&
          Number.isFinite(item.value) &&
          (cutoff === null || item.time >= cutoff)
      )
      .sort((a, b) => a.time - b.time);
  }, [history, selectedRange.milliseconds, now]);

  const first = chartData[0]?.value;
  const last = chartData[chartData.length - 1]?.value;

  const change =
    first !== undefined && last !== undefined
      ? last - first
      : null;

  const changePercent =
    change !== null && first !== undefined && first !== 0
      ? (change / first) * 100
      : null;

  const positive = (change ?? 0) >= 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            Portfolio Value History
          </p>

          <h3 className="mt-2 text-3xl font-semibold text-white">
            {last !== undefined ? money(last) : "—"}
          </h3>

          {change !== null && (
            <p
              className={`mt-2 text-sm font-medium ${
                positive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {positive ? "+" : ""}
              {money(change)}
              {changePercent !== null &&
                ` (${positive ? "+" : ""}${changePercent.toFixed(2)}%)`}
              <span className="ml-2 font-normal text-slate-400">
                recorded value change
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-950 p-1">
          {ranges.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setRange(item.label)}
              aria-pressed={range === item.label}
              className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                range === item.label
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 h-72">
        {error ? (
          <div className="flex h-full items-center justify-center text-sm text-red-400">
            {error}
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading recorded history...
          </div>
        ) : chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
            Not enough recorded observations for {range}.
            <br />
            Keep the simulator and backend running.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient
                  id="portfolioHistoryFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#34d399"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor="#34d399"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#334155"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                minTickGap={35}
                tickFormatter={(timestamp: number) =>
                  new Date(timestamp).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
              />

              <YAxis
                domain={["auto", "auto"]}
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                width={100}
                tickFormatter={(value: number) =>
                  `₹${Math.round(value).toLocaleString("en-IN")}`
                }
              />

              <Tooltip
                labelFormatter={(timestamp) =>
                  new Date(Number(timestamp)).toLocaleString("en-IN")
                }
                formatter={(value) => [
                  money(Number(value)),
                  "Portfolio value",
                ]}
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  color: "#f8fafc",
                }}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#portfolioHistoryFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <span>
          {chartData.length} observations in selected range
        </span>
        <span>
          PostgreSQL · Go simulated prices · 30s recording
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Change represents the difference between recorded portfolio
        values, not investment returns. Available history is limited
        to the latest 240 snapshots returned by the API.
      </p>
    </section>
  );
}