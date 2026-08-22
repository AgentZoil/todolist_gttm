"use client";

import { Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  completedOnTime: {
    label: "Hoàn thành đúng hạn",
    color: "#10B981",
  },
  completedLate: {
    label: "Hoàn thành quá hạn",
    color: "#F59E0B",
  },
  inProgressOnTime: {
    label: "Chưa HT - còn hạn",
    color: "#3B82F6",
  },
  inProgressLate: {
    label: "Chưa HT - hết hạn",
    color: "#EF4444",
  },
  noEvaluation: {
    label: "Không đánh giá",
    color: "#CBD5E1",
  },
} satisfies ChartConfig;

interface TaskStatusDonutProps {
  completedOnTime: number;
  completedLate: number;
  inProgressOnTime: number;
  inProgressLate: number;
  noEvaluation: number;
  completionRate: number;
  total: number;
}

export function TaskStatusDonut({
  completedOnTime,
  completedLate,
  inProgressOnTime,
  inProgressLate,
  noEvaluation,
  completionRate,
  total,
}: TaskStatusDonutProps) {
  const data = [
    { name: "completedOnTime", value: completedOnTime, fill: "#10B981" },
    { name: "completedLate", value: completedLate, fill: "#F59E0B" },
    { name: "inProgressOnTime", value: inProgressOnTime, fill: "#3B82F6" },
    { name: "inProgressLate", value: inProgressLate, fill: "#EF4444" },
    { name: "noEvaluation", value: noEvaluation, fill: "#CBD5E1" },
  ].filter((d) => d.value > 0);

  return (
    <div className="relative">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="name"
                formatter={(value, name) => {
                  const config = chartConfig[name as keyof typeof chartConfig];
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{config?.label ?? name}</span>
                      <span className="font-mono font-semibold">{String(value)}</span>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={70}
            outerRadius={110}
            strokeWidth={2}
            stroke="#fff"
          />
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            verticalAlign="bottom"
          />
        </PieChart>
      </ChartContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: "1.5rem" }}>
        <span className="text-3xl font-bold tabular-nums text-foreground">{completionRate}%</span>
        <span className="text-xs text-muted-foreground">hoàn thành</span>
        <span className="text-[10px] text-muted-foreground/60 mt-0.5">{total} nhiệm vụ</span>
      </div>
    </div>
  );
}
