'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Leaf, Paperclip, Send } from "lucide-react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useActions, useUIState } from "ai/rsc";
import { ThinkingBlock } from "@/components/ai/ThinkingBlock";
import { seedFromUpload } from "@/lib/actions";
import {
  detectDelimiterFromHeaderLine,
  pickReservationFieldsLoose,
} from "@/lib/csv-utils";
import type { AIProvider } from "@/app/action";

export function ChatPanel() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useUIState<AIProvider>();
  const { submitUserMessage, resetConversation } = useActions<AIProvider>();
  const [isSending, setIsSending] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<
    | { kind: "info" | "success" | "error"; message: string }
    | null
  >(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    if (toast.kind === "info") return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (!el) return;

    const isNearBottom = () =>
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    const observer = new MutationObserver(() => {
      if (isNearBottom()) {
        el.scrollTop = el.scrollHeight;
      }
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [isOpen]);

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    setToast({ kind: "info", message: `Ingesting ${file.name}...` });
    try {
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
        throw new Error(parsed.errors[0]?.message ?? "Failed to parse CSV.");
      }

      const rows = (parsed.data ?? [])
        .filter((value): value is Record<string, unknown> => {
          return Boolean(value) && typeof value === "object" && !Array.isArray(value);
        })
        .map(pickReservationFieldsLoose);

      const validRows = rows.filter(
        (row) => row["Check in Date"] && row["Check out Date"],
      );

      if (rows.length === 0 || validRows.length === 0) {
        throw new Error("Could not parse CSV format. Please check delimiters.");
      }

      await seedFromUpload(rows);
      setToast({ kind: "success", message: "Dashboard Updated." });
      await resetConversation();
      setMessages([]);
      router.refresh();
    } catch (error: unknown) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!isOpen) return;

    const value = input;
    setInput("");
    const tempId = Date.now();

    // Optimistic append: user bubble + thinking placeholder
    setMessages((current) => [
        ...current,
        {
          id: tempId,
          display: (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white shadow-sm">
                {value}
              </div>
            </div>
          ),
        },
        {
          id: tempId + 1,
          display: (
            <div className="flex justify-start">
              <div className="max-w-[85%] text-sm">
                <ThinkingBlock content="STEP: Connecting to Autumn..." isStreaming />
              </div>
            </div>
          ),
        },
      ]);

    setIsSending(true);
    try {
      const response = await submitUserMessage(value);
      setMessages((current) => [
        ...current.filter((m) => m.id !== tempId && m.id !== tempId + 1),
        {
          id: tempId,
          display: (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white shadow-sm">
                {value}
              </div>
            </div>
          ),
        },
        response,
      ]);
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessages((current) => current.filter((m) => m.id !== tempId + 1));
      setMessages((current) => [
        ...current,
        {
          id: tempId + 2,
          display: (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
                Error: {(error as Error).message}
              </div>
            </div>
          ),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const rendered = useMemo(
    () => messages.map((message) => <div key={message.id}>{message.display}</div>),
    [messages],
  );

  return (
    <div
      className={[
        "fixed bottom-6 right-6 z-50 flex w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl",
        isOpen ? "h-[600px]" : "h-14",
      ].join(" ")}
    >
      <div className="flex h-14 items-center justify-between bg-[#f8f5f2] px-4">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-slate-900" />
          <div className="text-sm font-semibold text-slate-900">autumn</div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-lg p-2 text-slate-600 hover:bg-white/60 hover:text-slate-900"
          aria-label={isOpen ? "Minimize Autopilot" : "Open Autopilot"}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {isOpen ? (
        <>
          {toast ? (
            <div className="px-4 pt-3">
              <div
                className={[
                  "rounded-lg px-3 py-2 text-xs font-medium",
                  toast.kind === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : toast.kind === "error"
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-slate-200 bg-slate-50 text-slate-700",
                ].join(" ")}
              >
                {toast.message}
              </div>
            </div>
          ) : null}

          <div
            ref={containerRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-700 shadow-sm">
                Welcome to Autumn. I&apos;ve processed your reservation history.
                How can I help you optimize your revenue today?
              </div>
            </div>
            {rendered}
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isUploading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Upload CSV"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending || isUploading}
            />
            <button
              type="submit"
              disabled={isSending || isUploading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Send className="h-4 w-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUploadFile(file);
              }}
            />
          </form>
        </>
      ) : null}
    </div>
  );
}
