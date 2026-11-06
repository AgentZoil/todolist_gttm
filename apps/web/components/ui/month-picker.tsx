"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [selectedYear, selectedMonth] = value.split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState(selectedYear);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Chọn thời gian: Tháng ${selectedMonth} năm ${selectedYear}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => {
          setDisplayYear(selectedYear);
          setOpen(!open);
        }}
        className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-4 text-sm font-medium shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <CalendarDays aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        Tháng {selectedMonth} năm {selectedYear}
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Chọn tháng và năm"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-lg sm:left-auto sm:right-0"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Xem năm trước"
              disabled={displayYear <= 1}
              onClick={() => setDisplayYear((year) => year - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <span aria-live="polite" className="text-sm font-semibold">Năm {displayYear}</span>
            <button
              type="button"
              aria-label="Xem năm sau"
              disabled={displayYear >= 9999}
              onClick={() => setDisplayYear((year) => year + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <button
                key={month}
                type="button"
                aria-pressed={displayYear === selectedYear && month === selectedMonth}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                  onChange(`${String(displayYear).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
                }}
                className={cn(
                  "min-h-11 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  displayYear === selectedYear && month === selectedMonth
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                Tháng {month}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
