"use client";

import Link from "next/link";
import { Printer } from "lucide-react";

export type PrintOption = { label: string; href: string; active: boolean };

/** Screen-only bar above a printable page: layout choices + Print. */
export function PrintToolbar({
  title,
  subtitle,
  options = [],
}: {
  title: string;
  subtitle?: string;
  options?: PrintOption[];
}) {
  return (
    <div className="no-print sticky top-0 z-10 border-b border-neutral-300 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-2 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">{title}</div>
          {subtitle && <div className="truncate text-[12px] text-neutral-500">{subtitle}</div>}
        </div>
        {options.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className={`rounded-md px-2.5 py-1.5 text-[12.5px] ring-1 ${
              o.active ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white ring-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {o.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-indigo-800"
        >
          <Printer className="h-4 w-4" />
          Хэвлэх
        </button>
      </div>
    </div>
  );
}
