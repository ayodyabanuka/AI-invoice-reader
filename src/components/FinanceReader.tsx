"use client";

import { useCallback, useRef, useState } from "react";
import type { FinanceDocumentRow } from "@/types/finance-document";

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FinanceReader() {
  const [rows, setRows] = useState<FinanceDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreview(dataUrl);

      const res = await fetch("/api/read-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: file.type || "image/jpeg",
        }),
      });

      const json = (await res.json()) as Partial<FinanceDocumentRow> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }

      const row: FinanceDocumentRow = {
        id: crypto.randomUUID(),
        shopName: json.shopName ?? "",
        date: json.date ?? "",
        total: json.total ?? "",
        data: json.data ?? "",
      };

      setRows((prev) => [row, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await processImage(file);
  };

  const clearDocuments = () => {
    setRows([]);
    setPreview(null);
    setError(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-teal-600 dark:text-teal-400">
          Gemini vision
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Bill & invoice reader
        </h1>
        <p className="max-w-xl text-pretty text-base text-zinc-600 dark:text-zinc-400">
          Upload or capture a receipt. We parse shop name, date, total, and a
          short summary — shown only in this session (nothing is saved).
        </p>
      </header>

      <section className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Add a document
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:pointer-events-none disabled:opacity-50"
            >
              Upload image
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 disabled:pointer-events-none disabled:opacity-50"
            >
              Capture photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Use “Capture photo” on a phone for the camera; on desktop it may fall
            back to picking a file depending on browser support.
          </p>
          {loading && (
            <p className="text-sm text-teal-700 dark:text-teal-400">
              Reading image with Gemini…
            </p>
          )}
          {error && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 lg:w-72">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Last capture preview
          </p>
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Last uploaded receipt preview"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center px-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
                No image yet
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Finance documents
          </h2>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={clearDocuments}
              className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear table
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-14 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-500">
            Documents you add appear here as rows — no database, no persistence.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-100/90 dark:border-zinc-800 dark:bg-zinc-900/70">
                <tr>
                  <th className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    Shop
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    Date
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    Total
                  </th>
                  <th className="min-w-[220px] px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                    Data / summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
                  >
                    <td className="max-w-[180px] px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.shopName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {row.date || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                      {row.total || "—"}
                    </td>
                    <td className="max-w-xl px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {row.data || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
