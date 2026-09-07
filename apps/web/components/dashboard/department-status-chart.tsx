"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";

interface DepartmentStats {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  total: number;
  completedOnTime: number;
  completedLate: number;
  inProgressOnTime: number;
  inProgressLate: number;
  noEvaluation: number;
  completionRate: number;
}

const STATUS_CONFIG = [
  { key: "completedOnTime", label: "Hoàn thành trước hạn", color: "#10B981" },
  { key: "completedLate", label: "Hoàn thành quá hạn", color: "#F97316" },
  { key: "inProgressOnTime", label: "Đang thực hiện", color: "#3B82F6" },
  { key: "inProgressLate", label: "Không hoàn thành", color: "#EF4444" },
  { key: "noEvaluation", label: "Không đánh giá", color: "#CBD5E1" },
] as const;

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  payload: Record<string, number> & { _name: string; total: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0].payload;
  const name = row._name as string;
  const total = row.total as number;
  const completed = (row.completedOnTime as number) + (row.completedLate as number);
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-[0_8px_30px_-4px_rgba(79,70,229,0.15)] backdrop-blur-md ring-1 ring-primary/5">
      <div className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">{name}</p>
      </div>
      <div className="px-4 py-3">
        <div className="space-y-2">
          {STATUS_CONFIG.map((s) => {
            const val = row[s.key] as number;
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className="inline-block h-2 w-2 flex-shrink-0 rounded-full ring-2 ring-offset-1"
                  style={{
                    backgroundColor: s.color,
                    ringColor: s.color,
                    "--tw-ring-color": `${s.color}33`,
                  } as React.CSSProperties}
                />
                <span className="flex-1 text-xs text-muted-foreground">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-foreground">{val}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground/70">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tổng nhiệm vụ</span>
            <span className="font-bold tabular-nums text-foreground">{total}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tỷ lệ hoàn thành</span>
            <span
              className={`font-bold tabular-nums ${
                rate >= 80
                  ? "text-emerald-500"
                  : rate >= 50
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {rate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DepartmentStatusChart({ data }: { data: DepartmentStats[] }) {
  const chartData = data.map((d) => ({
    _name: d.departmentName,
    total: d.total,
    completedOnTime: d.completedOnTime,
    completedLate: d.completedLate,
    inProgressOnTime: d.inProgressOnTime,
    inProgressLate: d.inProgressLate,
    noEvaluation: d.noEvaluation,
  }));

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.08)] transition-shadow duration-300 hover:shadow-[0_10px_25px_-5px_rgba(79,70,229,0.12)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-[0_4px_12px_0_rgba(79,70,229,0.25)]">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Biểu đồ tổng hợp theo phòng ban
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Phân bổ trạng thái nhiệm vụ</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-3 pt-1">
        {STATUS_CONFIG.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs font-medium text-foreground/80">{s.label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(Math.round(chartData.length * 32 * 0.75) + 30, 200)}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 48, left: 8, bottom: 4 }}
          barCategoryGap="20%"
        >
          <defs>
            <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E2E8F0" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#E2E8F0" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid
            horizontal={false}
            stroke="url(#gridGrad)"
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: "#334155", fontWeight: 600, fontFamily: "Plus Jakarta Sans, sans-serif" }}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0", strokeWidth: 1 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="_name"
            width={260}
            tick={{ fontSize: 12, fill: "#0F172A", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(79,70,229,0.04)" }}
          />

          {STATUS_CONFIG.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                radius={[0, 0, 0, 0]}
              >
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={s.color}
                    fillOpacity={0.9}
                  />
                ))}
              </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
