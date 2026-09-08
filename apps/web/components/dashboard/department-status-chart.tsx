"use client";

import { useEffect, useRef, useState } from "react";
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
import type { Coordinate } from "recharts";
import { BarChart3, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

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

interface ChartDataRow {
  _id: string;
  _name: string;
  _displayName: string;
  total: number;
  completedOnTime: number;
  completedLate: number;
  inProgressOnTime: number;
  inProgressLate: number;
  noEvaluation: number;
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
  payload: ChartDataRow;
}

interface StaticTooltip {
  x: number;
  y: number;
  data: DepartmentStats;
}

interface ChartInteractionState {
  activeTooltipIndex?: number | string | null;
  activeLabel?: string | number;
  activeCoordinate?: Coordinate;
}

function getCompletionRate(row: ChartDataRow | DepartmentStats) {
  const completed = row.completedOnTime + row.completedLate;
  return row.total > 0 ? Math.round((completed / row.total) * 100) : 0;
}

function TooltipContent({
  name,
  total,
  rate,
  row,
  onViewDetail,
}: {
  name: string;
  total: number;
  rate: number;
  row: ChartDataRow | DepartmentStats;
  onViewDetail?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-[0_8px_30px_-4px_rgba(79,70,229,0.15)] backdrop-blur-md ring-1 ring-primary/5">
      <div className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">{name}</p>
      </div>
      <div className="px-4 py-3">
        <div className="space-y-2">
          {STATUS_CONFIG.map((s) => {
            const val = row[s.key] ?? 0;
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
          {onViewDetail && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onViewDetail();
              }}
              className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ExternalLink className="h-3 w-3" />
              Xem chi tiết
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
  return (
    <TooltipContent
      name={row._name}
      total={row.total}
      rate={getCompletionRate(row)}
      row={row}
    />
  );
}

function getStaticPosition(
  container: HTMLDivElement,
  fallback?: Coordinate,
): Coordinate | null {
  const tooltip = container.querySelector<HTMLElement>(".recharts-tooltip-wrapper");
  if (tooltip && tooltip.getBoundingClientRect().width > 0) {
    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    return {
      x: tooltipRect.left - containerRect.left,
      y: tooltipRect.top - containerRect.top,
    };
  }

  return fallback ?? null;
}

export function DepartmentStatusChart({
  data,
  selectedMonth,
}: {
  data: DepartmentStats[];
  selectedMonth: string;
}) {
  const router = useRouter();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [pinnedTooltip, setPinnedTooltip] = useState<StaticTooltip | null>(null);

  const chartData: ChartDataRow[] = data.map((department, index) => ({
    _id: department.departmentId,
    _name: department.departmentName,
    _displayName: `${index + 1}. ${department.departmentName}`,
    total: department.total,
    completedOnTime: department.completedOnTime,
    completedLate: department.completedLate,
    inProgressOnTime: department.inProgressOnTime,
    inProgressLate: department.inProgressLate,
    noEvaluation: department.noEvaluation,
  }));

  useEffect(() => {
    if (!pinnedTooltip) return;

    const handleMouseDown = (event: MouseEvent) => {
      const tooltip = event.target as Node;
      if (!event.currentTarget || !chartContainerRef.current?.contains(tooltip)) {
        setPinnedTooltip(null);
        return;
      }

      const pinnedElement = chartContainerRef.current.querySelector("[data-pinned-tooltip]");
      if (!pinnedElement?.contains(tooltip)) setPinnedTooltip(null);
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [pinnedTooltip]);

  const handleChartClick = (state: ChartInteractionState) => {
    if (!chartContainerRef.current) return;

    const index = state.activeTooltipIndex == null
      ? -1
      : Number(state.activeTooltipIndex);
    const department = Number.isInteger(index) && index >= 0
      ? data[index]
      : data.find((item, itemIndex) =>
          item.departmentName === state.activeLabel ||
          `${itemIndex + 1}. ${item.departmentName}` === state.activeLabel,
        );
    if (!department) return;

    const position = getStaticPosition(
      chartContainerRef.current,
      state.activeCoordinate,
    );
    if (!position) return;

    setPinnedTooltip({
      x: position.x,
      y: position.y,
      data: department,
    });
  };

  const buildDetailUrl = (departmentId: string) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const params = new URLSearchParams({
      departmentId,
      dateFrom: `${year}-${String(month).padStart(2, "0")}-01`,
      dateTo: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    });
    return `/tasks?${params.toString()}`;
  };

  const chartHeight = Math.max(Math.round(chartData.length * 32 * 0.75) + 30, 200);

  return (
    <div className="chart-without-outline rounded-2xl bg-card p-6 shadow-none">
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

      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-3 pt-1">
        {STATUS_CONFIG.map((status) => (
          <div key={status.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="text-xs font-medium text-foreground/80">{status.label}</span>
          </div>
        ))}
      </div>

      <div ref={chartContainerRef} className="relative cursor-pointer">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={chartData}
            accessibilityLayer={false}
            margin={{ top: 8, right: 48, left: 8, bottom: 4 }}
            barCategoryGap="20%"
            onClick={handleChartClick}
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
              dataKey="_displayName"
              width={280}
              tick={{ fontSize: 12, fill: "#0F172A", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(79,70,229,0.04)" }}
              wrapperStyle={pinnedTooltip ? { visibility: "hidden" } : undefined}
            />

            {STATUS_CONFIG.map((status) => (
              <Bar
                key={status.key}
                dataKey={status.key}
                stackId="a"
                radius={[0, 0, 0, 0]}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={status.color} fillOpacity={0.9} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>

        {pinnedTooltip && (
          <div
            data-pinned-tooltip
            className="pointer-events-auto absolute z-50"
            style={{ left: pinnedTooltip.x, top: pinnedTooltip.y }}
          >
            <TooltipContent
              name={pinnedTooltip.data.departmentName}
              total={pinnedTooltip.data.total}
              rate={getCompletionRate(pinnedTooltip.data)}
              row={pinnedTooltip.data}
              onViewDetail={() => router.push(buildDetailUrl(pinnedTooltip.data.departmentId))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
