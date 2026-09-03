"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  CartesianGrid,
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
  { key: "noEvaluation", label: "Chưa đánh giá", color: "#94A3B8" },
] as const;

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  payload: Record<string, number> & { _name: string };
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
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xl ring-1 ring-foreground/5">
      <p className="mb-2 text-sm font-semibold text-foreground">{name}</p>
      <div className="space-y-1.5">
        {STATUS_CONFIG.map((s) => {
          const val = row[s.key] as number;
          return (
            <div key={s.key} className="flex items-center justify-between gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted-foreground">{s.label}</span>
              </div>
              <span className="font-semibold tabular-nums text-foreground">{val}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
        <span className="font-medium text-muted-foreground">Tổng</span>
        <span className="font-bold tabular-nums text-foreground">{total}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">Tỷ lệ hoàn thành</span>
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
  );
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-3 pt-1">
      {STATUS_CONFIG.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
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

  const barHeight = 30;
  const chartHeight = Math.max(chartData.length * barHeight + 30, 200);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <BarChart3 className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Biểu đồ tổng hợp theo phòng ban
          </h3>
          <p className="text-xs text-muted-foreground">Phân bổ trạng thái nhiệm vụ</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            horizontal={false}
            strokeDasharray="3 3"
            stroke="#E2E8F0"
            strokeOpacity={0.6}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748B" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="_name"
            width={260}
            tick={{ fontSize: 12, fill: "#0F172A", fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.03)" }}
          />
          <Legend content={<CustomLegend />} verticalAlign="top" />

          {STATUS_CONFIG.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.color}
              radius={i === STATUS_CONFIG.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
            >
              <LabelList
                position="inside"
                fill="#fff"
                fontSize={11}
                fontWeight={600}
                formatter={(v) => (Number(v) > 0 ? v : "")}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
