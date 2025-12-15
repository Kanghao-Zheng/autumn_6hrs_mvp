'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ManualOverrideCardProps = {
  startDate: string;
  endDate: string;
  price: number;
};

export function ManualOverrideCard({
  startDate,
  endDate,
  price,
}: ManualOverrideCardProps) {
  const router = useRouter();

  useEffect(() => {
    const refreshKey = `autumn:manual-override:${startDate}:${endDate}:${price}`;
    try {
      if (typeof window !== "undefined") {
        const alreadyRefreshed = window.sessionStorage.getItem(refreshKey);
        if (alreadyRefreshed) return;
        window.sessionStorage.setItem(refreshKey, "1");
      }
    } catch {
      // If storage is unavailable, fall back to a best-effort refresh.
    }

    router.refresh();
  }, [endDate, price, router, startDate]);

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Manual Override
      </div>
      <div className="mt-1 text-sm text-slate-700">
        Set{" "}
        <span className="font-semibold text-slate-900">{startDate}</span> to{" "}
        <span className="font-semibold text-slate-900">{endDate}</span> at{" "}
        <span className="font-semibold text-slate-900">${price}</span>.
      </div>
    </div>
  );
}
