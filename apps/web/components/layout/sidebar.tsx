"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Building2,
  Users,
  ScrollText,
  Lock,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface UserInfo {
  role: string;
}

const allNavItems = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Nhiệm vụ", href: "/tasks", icon: ListTodo },
  { label: "Phòng ban/Đơn vị", href: "/departments", icon: Building2 },
  { label: "Người dùng", href: "/users", icon: Users, roles: ["ADMIN", "SECRETARY"] },
  { label: "Khóa tháng", href: "/period-locks", icon: Lock, roles: ["ADMIN"] },
  { label: "Nhật ký hoạt động", href: "/audit-logs", icon: ScrollText, roles: ["ADMIN"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    apiFetch<{ data: UserInfo }>("/auth/me")
      .then((res) => setUserRole(res.data.role))
      .catch(() => {});
  }, []);

  const navItems = allNavItems.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Collapse toggle - floating circle on right edge */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground"
      >
        {collapsed ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
      </button>
      {/* Logo */}
      <div className={cn("flex items-center border-b border-border", collapsed ? "justify-center px-2 py-4" : "px-3 py-5")}>
        <Link
          href="/dashboard"
          aria-label="CỤC ĐƯỜNG BỘ VIỆT NAM - Hệ thống theo dõi nhiệm vụ"
          title={collapsed ? "CỤC ĐƯỜNG BỘ VIỆT NAM" : undefined}
          className="flex min-w-0 items-center gap-2"
        >
          <Image
            src="/branding/drvn-logo.png"
            alt=""
            width={100}
            height={100}
            className="h-10 w-10 shrink-0 object-contain"
            unoptimized
            priority
          />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-xs font-bold leading-4 tracking-tight text-foreground">
                CỤC ĐƯỜNG BỘ VIỆT NAM
              </span>
              <span className="mt-0.5 block text-[11px] font-medium leading-4 text-muted-foreground">
                Hệ thống theo dõi nhiệm vụ
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center rounded-xl text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-primary/10"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

    </aside>
  );
}
