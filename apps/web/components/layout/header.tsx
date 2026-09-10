"use client";

import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export function Header() {
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [inboxCount, setInboxCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    apiFetch<{ data: { fullName: string; role: string } }>("/auth/me")
      .then((res) => {
        setFullName(res.data.fullName);
        setRole(res.data.role);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const isReviewer = ["ADMIN", "LEADER", "SECRETARY"].includes(role);
    const isDepartmentEditor = role === "DEPARTMENT_EDITOR";
    if (!isReviewer && !isDepartmentEditor) return;

    const loadInboxCount = () => {
      const endpoint = isReviewer
        ? "/tasks/pending-approval?page=1&limit=1"
        : "/tasks/attention?page=1&limit=1";
      apiFetch<{ pagination: { total: number } }>(endpoint)
        .then((res) => setInboxCount(res.pagination.total))
        .catch(() => {});
    };

    loadInboxCount();
    window.addEventListener("inbox:refresh", loadInboxCount);
    const timer = window.setInterval(loadInboxCount, 60_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("inbox:refresh", loadInboxCount);
    };
  }, [role, pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-6">
        <div />
        <div className="flex items-center gap-3">
          {(["ADMIN", "LEADER", "SECRETARY"].includes(role) || role === "DEPARTMENT_EDITOR") && (
            <Link
              href={role === "DEPARTMENT_EDITOR" ? "/inbox" : "/approvals"}
              aria-label={role === "DEPARTMENT_EDITOR"
                ? `Hộp công việc${inboxCount > 0 ? `, ${inboxCount} việc cần xử lý` : ""}`
                : `Hộp duyệt${inboxCount > 0 ? `, ${inboxCount} nhiệm vụ chờ duyệt` : ""}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Inbox className="h-4.5 w-4.5" />
              {inboxCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-card">
                  {inboxCount > 99 ? "99+" : inboxCount}
                </span>
              )}
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-sm">
              {initials || <User className="h-4 w-4" />}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium leading-none">{fullName}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </div>
    </header>
  );
}
