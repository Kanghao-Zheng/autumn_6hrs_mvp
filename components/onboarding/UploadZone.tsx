'use client';

import { useCallback, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { seedDemoData, seedFromUpload } from "@/lib/actions";
import {
  detectDelimiterFromHeaderLine,
  pickReservationFieldsLoose,
} from "@/lib/csv-utils";

type UploadState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "uploading" }
  | { status: "error"; message: string }
  | { status: "done"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type UploadZoneProps = {
  title?: string;
  idleMessage?: string;
  showDemoButton?: boolean;
  onComplete?: () => void;
};

export function UploadZone({
  title = "Get Started with Autumn.",
  idleMessage = "Upload your data or try the demo environment.",
  showDemoButton = true,
  onComplete,
}: UploadZoneProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);

  const disabled = state.status === "parsing" || state.status === "uploading";

  const onFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setState({ status: "parsing" });

      const headerText = await file.slice(0, 4096).text();
      const headerLine = headerText.split(/\r?\n/)[0] ?? "";
      const delimiter = detectDelimiterFromHeaderLine(headerLine);

      const parsed = await new Promise<Papa.ParseResult<Record<string, unknown>>>(
        (resolve) => {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            delimiter,
            skipEmptyLines: true,
            dynamicTyping: false,
            transformHeader: (header) => header.trim().toLowerCase(),
            complete: resolve,
          });
        },
      );

      if (parsed.errors.length > 0) {
        setState({
          status: "error",
          message: parsed.errors[0]?.message ?? "Failed to parse CSV.",
        });
        return;
      }

      const rows = (parsed.data ?? []).filter(isRecord).map(pickReservationFieldsLoose);
      const validRows = rows.filter(
        (row) => row["Check in Date"] && row["Check out Date"],
      );

      if (rows.length === 0 || validRows.length === 0) {
        setState({
          status: "error",
          message: "Could not parse CSV format. Please check delimiters.",
        });
        return;
      }

      setState({ status: "uploading" });
      try {
        const result = await seedFromUpload(rows);
        setState({
          status: "done",
          message: `${result.reservationCount} reservations ingested.`,
        });
        onComplete?.();
        router.refresh();
      } catch (error: unknown) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    },
    [onComplete, router],
  );

  const onDemo = useCallback(async () => {
    setFileName(null);
    setState({ status: "uploading" });
    try {
      await seedDemoData();
      setState({ status: "done", message: "Demo environment loaded." });
      onComplete?.();
      router.refresh();
    } catch (error: unknown) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Demo seed failed.",
      });
    }
  }, [onComplete, router]);

  const onPick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) void onFile(file);
    },
    [onFile],
  );

  const message = useMemo(() => {
    switch (state.status) {
      case "idle":
        return idleMessage;
      case "parsing":
        return "Parsing CSV...";
      case "uploading":
        return "Building your Knowledge Graph...";
      case "done":
        return state.message;
      case "error":
        return state.message;
    }
  }, [idleMessage, state]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="group rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center shadow-sm transition hover:border-slate-400 hover:bg-white"
      >
        <div className="mx-auto max-w-sm">
          <div className="text-sm font-semibold text-slate-900">
            {title}
          </div>
          <div className="mt-1 text-xs text-slate-600">{message}</div>

          {fileName ? (
            <div className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {fileName}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onPick}
              disabled={disabled}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Choose CSV
            </button>
            <div className="text-xs text-slate-500">(.csv export)</div>
          </div>

          <div className="mt-3 flex items-center justify-center">
            {showDemoButton ? (
              <button
                type="button"
                onClick={onDemo}
                disabled={disabled}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use Demo Data
              </button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
