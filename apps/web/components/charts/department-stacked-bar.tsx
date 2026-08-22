"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
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
    label: "Đúng hạn",
    color: "#10B981",
  },
  completedLate: {
    label: "Quá hạn",
    color: "#F59E0B",
  },
  inProgressOnTime: {
    label: "Còn hạn",
    color: "#3B82F6",
  },
  inProgressLate: {
    label: "Hết hạn",
    color: "#EF4444",
  },
  noEvaluation: {
    label: "Không ĐG",
    color: "#CBD5E1",
  },
} satisfies ChartConfig;

interface DepartmentStackedBarProps {
  departments: {
    departmentName: string;
    completedOnTime: number;
    completedLate: number;
    inProgressOnTime: number;
    inProgressLate: number;
    noEvaluation: number;
  }[];
}

export function DepartmentStackedBar({ departments }: DepartmentStackedBarProps) {
  const data = departments.map((d) => ({
    name: d.departmentName.length > 15 ? d.departmentName.slice(0, 12) + "..." : d.departmentName,
    fullName: d.departmentName,
    completedOnTime: d.completedOnTime,
    completedLate: d.completedLate,
    inProgressOnTime: d.inProgressOnTime,
    inProgressLate: d.inProgressLate,
    noEvaluation: d.noEvaluation,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[350px] w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
      >
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={110}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
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
        <ChartLegend content={<ChartLegendContent />} verticalAlign="bottom" />
        <Bar
          dataKey="completedOnTime"
          stackId="a"
          fill="#10B981"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="completedLate"
          stackId="a"
          fill="#F59E0B"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="inProgressOnTime"
          stackId="a"
          fill="#3B82F6"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="inProgressLate"
          stackId="a"
          fill="#EF4444"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="noEvaluation"
          stackId="a"
          fill="#CBD5E1"
          radius={[0, 2, 2, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
