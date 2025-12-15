'use client';

import { Calendar, Home, Megaphone, Settings, UploadCloud } from "lucide-react";
import { SettingsDialog } from "@/components/dashboard/SettingsDialog";
import { UploadDialog } from "@/components/dashboard/UploadDialog";

const navItemBase =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";

export function Sidebar() {
  return (
    <aside className="flex h-screen w-[240px] flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-sm font-bold text-white shadow-sm">
          a
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">autumn</div>
          <div className="text-xs text-slate-500">Command Center</div>
        </div>
      </div>

      <nav className="px-3">
        <button
          type="button"
          className={`${navItemBase} bg-slate-50 text-slate-900`}
          aria-current="page"
        >
          <Home className="h-4 w-4 text-slate-700" />
          Home
        </button>

        <button
          type="button"
          className={`${navItemBase} text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
          disabled
        >
          <Calendar className="h-4 w-4" />
          Calendar
        </button>

        <button
          type="button"
          className={`${navItemBase} text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
          disabled
        >
          <Megaphone className="h-4 w-4" />
          Marketing
        </button>
      </nav>

      <div className="mt-auto space-y-2 px-3 pb-6">
        <UploadDialog
          trigger={
            <button
              type="button"
              className={`${navItemBase} text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
            >
              <UploadCloud className="h-4 w-4" />
              Upload Data
            </button>
          }
        />
        <SettingsDialog
          trigger={
            <button
              type="button"
              className={`${navItemBase} text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          }
        />
      </div>
    </aside>
  );
}
