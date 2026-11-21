"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, ListFilter, Loader2, Printer, Search, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { apiDownload, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  defaultFilters, formatReportDate, reportQuery, reportScopeLabel, reportSummaryRows, STATUS_OPTIONS,
  type ReportData, type ReportFilters, type ReportTask,
} from "./report-data";
import { ReportPrint } from "./report-print";

interface UserInfo { role: string; fullName: string }
interface Department { id: string; name: string }
type Access = { user: UserInfo; departments: Department[] } | { error: string };
type ReportRequest = { query: string };
type ReportResult = { request: ReportRequest } & ({ report: ReportData } | { error: string });

const PAGE_SIZE = 20;
const selectClass = "h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";
const statusColors: Record<ReportTask["status"], string> = {
  COMPLETED_EARLY: "bg-emerald-50 text-emerald-800",
  COMPLETED_ON_TIME: "bg-emerald-50 text-emerald-800",
  COMPLETED_LATE: "bg-orange-50 text-orange-800",
  IN_PROGRESS: "bg-blue-50 text-blue-800",
  INCOMPLETE: "bg-rose-50 text-rose-800",
  CANCELLED: "bg-muted text-slate-700",
  NO_EVALUATION: "bg-muted text-slate-700",
};

function StatusBadge({ task }: { task: ReportTask }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", statusColors[task.status])}>{task.statusLabel}</span>;
}

function ReportTaskDialog({ task, onClose }: { task: ReportTask | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (task && dialog && !dialog.open) dialog.showModal();
  }, [task]);

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby="report-task-title" className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/55 print:hidden">
      {task && (
        <>
          <header className="sticky top-0 flex items-start justify-between gap-4 border-b bg-card px-5 py-4">
            <div>
              <h2 id="report-task-title" className="text-lg font-semibold wrap-anywhere">{task.title}</h2>
              <div className="mt-2"><StatusBadge task={task} /></div>
            </div>
            <form method="dialog">
              <Button type="submit" variant="ghost" size="icon" aria-label="Đóng chi tiết" className="size-11"><X /></Button>
            </form>
          </header>
          <div className="space-y-5 p-5 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Số văn bản", task.documentNumber || "—"],
                ["Lãnh đạo giao", task.assignedBy],
                ["Đơn vị chủ trì", task.ownerDepartmentName],
                ["Đơn vị phối hợp", task.coordinatingUnits || "—"],
                ["Ngày giao", formatReportDate(task.assignedDate)],
                ["Hạn hoàn thành", formatReportDate(task.requiredCompletionDate)],
                ["Ngày hoàn thành thực tế", formatReportDate(task.actualCompletionDate)],
              ].map(([label, value]) => (
                <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium wrap-anywhere">{value}</dd></div>
              ))}
            </dl>
            {[
              ["Nội dung nhiệm vụ", task.content],
              ["Tiến độ / Bằng chứng", task.completionEvidence],
              ["Lý do chưa hoàn thành", task.incompleteReason],
              ["Ý kiến chỉ đạo", task.directives.join("\n")],
            ].filter(([, value]) => value).map(([label, value]) => (
              <section key={label}>
                <h3 className="font-semibold">{label}</h3>
                <p className="mt-1 rounded-lg bg-muted/65 p-3 leading-relaxed whitespace-pre-wrap wrap-anywhere">{value}</p>
              </section>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}

export default function ReportsPage() {
  const [access, setAccess] = useState<Access | null>(null);
  const [accessRevision, setAccessRevision] = useState(0);
  const [draft, setDraft] = useState(defaultFilters);
  const [request, setRequest] = useState<ReportRequest>(() => ({ query: reportQuery(draft) }));
  const [result, setResult] = useState<ReportResult | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selectedTask, setSelectedTask] = useState<ReportTask | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function loadAccess() {
      try {
        const { data: user } = await apiFetch<{ data: UserInfo }>("/auth/me", { signal });
        const departments = user.role === "ADMIN"
          ? (await apiFetch<{ data: Department[] }>("/departments", { signal })).data
          : [];
        if (!signal.aborted) setAccess({ user, departments });
      } catch (error) {
        if (!signal.aborted) {
          setAccess({ error: error instanceof Error ? error.message : "Không tải được thông tin truy cập." });
        }
      }
    }
    void loadAccess();
    return () => controller.abort();
  }, [accessRevision]);

  const authorized = !!access && "user" in access && access.user.role === "ADMIN";
  useEffect(() => {
    if (!authorized) return;
    const controller = new AbortController();
    const { signal } = controller;
    apiFetch<ReportData>(`/reports/tasks?${request.query}`, { signal })
      .then((report) => {
        if (!signal.aborted) setResult({ request, report });
      })
      .catch((error: unknown) => {
        if (!signal.aborted) setResult({ request, error: error instanceof Error ? error.message : "Không tải được báo cáo." });
      });
    return () => controller.abort();
  }, [authorized, request]);

  const activeResult = result?.request === request ? result : null;
  const report = activeResult && "report" in activeResult ? activeResult.report : null;
  const reportError = activeResult && "error" in activeResult ? activeResult.error : "";
  const loading = authorized && !activeResult;
  const draftQuery = reportQuery(draft);
  const hasChanges = draftQuery !== request.query;
  const validRange = draft.dateFilterType !== "CUSTOM" || (
    Boolean(draft.dateFrom || draft.dateTo) && (!draft.dateFrom || !draft.dateTo || draft.dateFrom <= draft.dateTo)
  );
  const readyToOutput = !!report?.tasks.length && !hasChanges && !exporting;
  const totalPages = Math.max(1, Math.ceil((report?.tasks.length ?? 0) / PAGE_SIZE));
  const firstIndex = (page - 1) * PAGE_SIZE;
  const rows = report?.tasks.slice(firstIndex, firstIndex + PAGE_SIZE) ?? [];

  function changeFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function loadReport(query: string) {
    setPage(1);
    setExportError("");
    setRequest({ query });
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validRange && hasChanges) loadReport(draftQuery);
  }

  async function exportExcel() {
    if (!readyToOutput) return;
    setExporting(true);
    setExportError("");
    try {
      await apiDownload(`/reports/tasks/export?${request.query}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Không xuất được báo cáo Excel.");
    } finally {
      setExporting(false);
    }
  }

  if (!access) return <p role="status" className="flex gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Đang tải quyền truy cập…</p>;
  if ("error" in access) {
    return (
      <Card className="max-w-xl gap-3 p-5">
        <p role="alert" className="text-sm">{access.error}</p>
        <Button variant="outline" className="w-fit" onClick={() => { setAccess(null); setAccessRevision((value) => value + 1); }}>Thử lại</Button>
      </Card>
    );
  }

  // Phase 1 restriction: ADMIN only
  if (!authorized) {
    return (
      <Card className="mx-auto max-w-lg items-center p-8 text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <h1 className="text-xl font-semibold">Giới hạn quyền truy cập</h1>
        <p className="text-sm text-muted-foreground">Báo cáo dành cho quản trị viên.</p>
      </Card>
    );
  }

  return (
    <>
      {/* SCREEN VIEW: UI nhất quán chuẩn với /tasks và Dashboard */}
      <div className="space-y-6 print:hidden">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">Báo cáo nhiệm vụ</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tổng hợp kết quả thực hiện theo kỳ và đơn vị chủ trì.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button type="button" variant="outline" size="lg" className="bg-card shadow-sm" disabled={!readyToOutput} onClick={() => window.print()}><Printer /> In báo cáo</Button>
            <Button type="button" size="lg" className="shadow-sm" disabled={!readyToOutput} onClick={exportExcel}>
              {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} {exporting ? "Đang xuất…" : "Xuất Excel"}
            </Button>
          </div>
        </header>

        <Card className="gap-0 overflow-visible py-0 shadow-sm">
          <form onSubmit={applyFilters} className="space-y-3 p-4" aria-labelledby="report-filter-title">
            <div>
              <h2 id="report-filter-title" className="flex items-center gap-2 text-base font-semibold"><ListFilter className="size-4 text-primary" /> Bộ lọc</h2>
              <p className="mt-1 text-xs text-muted-foreground">Kỳ báo cáo tính theo hạn hoàn thành. Nhiệm vụ không có hạn dùng ngày giao.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5 text-sm font-medium">
                <label className="block" htmlFor="report-period">Kỳ báo cáo</label>
                <select id="report-period" className={selectClass} value={draft.dateFilterType} onChange={(event) => changeFilter("dateFilterType", event.target.value as ReportFilters["dateFilterType"])}>
                  <option value="MONTH">Theo tháng</option>
                  <option value="YEAR">Theo năm</option>
                  <option value="CUSTOM">Khoảng ngày</option>
                  <option value="ALL">Toàn thời gian</option>
                </select>
              </div>
              {draft.dateFilterType === "MONTH" && (
                <div className="space-y-1.5 text-sm font-medium"><p>Tháng</p><MonthPicker value={draft.month} onChange={(month) => changeFilter("month", month)} /></div>
              )}
              {draft.dateFilterType === "YEAR" && (
                <label className="space-y-1.5 text-sm font-medium">
                  <span className="block">Năm</span>
                  <Input className="h-10" inputMode="numeric" pattern="[1-9][0-9]{3}" maxLength={4} required value={draft.year} onChange={(event) => changeFilter("year", event.target.value)} />
                </label>
              )}
              {draft.dateFilterType === "CUSTOM" && (
                <>
                  <label className="space-y-1.5 text-sm font-medium"><span className="block">Từ ngày</span><Input type="date" className="h-10" min="1000-01-01" max="9999-12-31" value={draft.dateFrom} onChange={(event) => changeFilter("dateFrom", event.target.value)} /></label>
                  <label className="space-y-1.5 text-sm font-medium"><span className="block">Đến ngày</span><Input type="date" className="h-10" min="1000-01-01" max="9999-12-31" value={draft.dateTo} onChange={(event) => changeFilter("dateTo", event.target.value)} /></label>
                </>
              )}
              <div className="space-y-1.5 text-sm font-medium">
                <label className="block" htmlFor="report-department">Đơn vị chủ trì</label>
                <select id="report-department" className={selectClass} value={draft.departmentId} onChange={(event) => changeFilter("departmentId", event.target.value)}>
                  <option value="">Toàn cơ quan</option>
                  {access.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 text-sm font-medium">
                <label className="block" htmlFor="report-status">Trạng thái</label>
                <select id="report-status" className={selectClass} value={draft.statusGroup} onChange={(event) => changeFilter("statusGroup", event.target.value as ReportFilters["statusGroup"])}>
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 space-y-1.5 text-sm font-medium">
                <span className="block">Từ khóa</span>
                <span className="relative block">
                  <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" className="h-10 pl-9" placeholder="Tên nhiệm vụ, số văn bản, đơn vị hoặc người giao" maxLength={200} value={draft.search} onChange={(event) => changeFilter("search", event.target.value)} />
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="lg" className="h-10 bg-card shadow-sm" onClick={() => {
                  const next = defaultFilters();
                  setDraft(next);
                  const query = reportQuery(next);
                  if (query !== request.query || reportError) loadReport(query);
                }}>Đặt lại</Button>
                <Button type="submit" size="lg" className="h-10 shadow-sm" disabled={!hasChanges || !validRange}>Áp dụng bộ lọc</Button>
              </div>
            </div>
            {!validRange && <p role="alert" className="text-sm text-rose-700">{draft.dateFrom || draft.dateTo ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." : "Chọn ít nhất một mốc ngày."}</p>}
            {hasChanges && validRange && <p role="status" className="text-sm text-muted-foreground">Áp dụng bộ lọc để cập nhật kết quả, in hoặc xuất Excel.</p>}
          </form>
        </Card>

        {exportError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{exportError}</p>}
        {loading && <p role="status" className="flex items-center gap-2 rounded-xl border bg-card p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Đang tải báo cáo…</p>}
        {reportError && (
          <Card className="gap-3 p-5">
            <p role="alert" className="text-sm text-rose-800">{reportError}</p>
            <Button variant="outline" className="w-fit" onClick={() => loadReport(request.query)}>Thử lại</Button>
          </Card>
        )}

        {report && (
          <>
            <section aria-label="Tổng hợp kết quả" className="space-y-3">
              <p className="text-sm text-muted-foreground wrap-anywhere">{reportScopeLabel(report.scope)}</p>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Tổng nhiệm vụ", report.summary.total],
                  ["Đã hoàn thành", report.summary.totalCompleted],
                  ["Tỷ lệ xử lý", `${report.summary.completionRate}%`],
                  ["Tỷ lệ đúng hạn", `${report.summary.onTimeRate}%`],
                ].map(([label, value]) => (
                  <Card key={label} className="gap-1 p-3 shadow-sm sm:p-4">
                    <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
                    <dd className="text-2xl font-bold text-foreground tabular-nums">{value}</dd>
                  </Card>
                ))}
              </dl>
              <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm">
                <summary className="w-fit cursor-pointer rounded font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Chi tiết theo trạng thái</summary>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {reportSummaryRows(report.summary).slice(1, 8).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-muted/70 px-3 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">Tỷ lệ xử lý loại trừ nhiệm vụ đã hủy và không đánh giá. Tỷ lệ đúng hạn tính trên số nhiệm vụ đã hoàn thành.</p>
              </details>
            </section>

            <Card className="gap-0 py-0 shadow-sm">
              <div className="border-b px-4 py-3">
                <h2 className="text-base font-semibold">Danh sách nhiệm vụ</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rows.length ? `Hiển thị ${firstIndex + 1}–${firstIndex + rows.length} / ${report.tasks.length} nhiệm vụ. In và xuất gồm toàn bộ kết quả.` : "Không có nhiệm vụ phù hợp với bộ lọc."}
                </p>
              </div>
              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/70 text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">Nhiệm vụ</th>
                        <th scope="col" className="hidden px-3 py-3 font-medium md:table-cell">Đơn vị chủ trì</th>
                        <th scope="col" className="hidden px-3 py-3 font-medium lg:table-cell">Hạn hoàn thành</th>
                        <th scope="col" className="hidden px-3 py-3 font-medium lg:table-cell">Hoàn thành thực tế</th>
                        <th scope="col" className="px-3 py-3 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((task) => (
                        <tr key={task.id} className="hover:bg-muted/35">
                          <td className="min-w-0 px-4 py-2.5">
                            <button type="button" className="min-h-11 rounded text-left font-medium text-foreground wrap-anywhere hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-0" onClick={() => setSelectedTask(task)}>{task.title}</button>
                            <p className="text-xs text-muted-foreground wrap-anywhere">{task.documentNumber || "—"}</p>
                            <p className="text-xs text-muted-foreground wrap-anywhere md:hidden">{task.ownerDepartmentName}</p>
                          </td>
                          <td className="hidden px-3 py-3 md:table-cell">{task.ownerDepartmentName}</td>
                          <td className="hidden px-3 py-3 tabular-nums lg:table-cell">{formatReportDate(task.requiredCompletionDate)}</td>
                          <td className="hidden px-3 py-3 tabular-nums lg:table-cell">{formatReportDate(task.actualCompletionDate)}</td>
                          <td className="px-3 py-3"><StatusBadge task={task} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {totalPages > 1 && (
                <nav aria-label="Phân trang báo cáo" className="flex items-center justify-between gap-3 border-t px-4 py-3">
                  <span className="text-sm text-muted-foreground">Trang {page} / {totalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" className="size-11 sm:size-8" size="icon" aria-label="Trang trước" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
                    <Button variant="outline" className="size-11 sm:size-8" size="icon" aria-label="Trang sau" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
                  </div>
                </nav>
              )}
            </Card>
          </>
        )}
        <ReportTaskDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
      </div>

      {/* PRINT VIEW: Chuẩn văn bản hành chính Việt Nam (Nghị định 30/2020/NĐ-CP) */}
      {report && !hasChanges && report.tasks.length > 0 && <ReportPrint report={report} author={access.user.fullName} />}
    </>
  );
}
