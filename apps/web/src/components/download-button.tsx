"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { MediaSummary } from "@fusion-lab/shared-types";
import { API_URL } from "@/lib/api-client";
import { auth } from "@/lib/firebase";

// A paid file cannot be a plain <a href>: the endpoint requires an
// Authorization header, and a link element cannot send one. So the bytes
// are fetched with the token, turned into a blob URL, and handed to a
// synthetic <a download> — which is what makes the browser save the file
// under its real name instead of navigating to it.
export function DownloadButton({
  file,
  label,
  className = "btn-ghost",
}: {
  file: MediaSummary;
  /**
   * Підпис кнопки. За замовчуванням — нейтральне «Завантажити», бо поруч
   * у списку вже стоїть назва файла. Але там, де файл ОДИН і він і є
   * причиною, чому покупець відкрив сторінку (книга в бібліотеці),
   * кнопка має називати саме дію: «Завантажити книгу».
   */
  label?: string;
  /** `btn-ghost` у переліках, `btn-primary` там, де це головна дія. */
  className?: string;
}) {
  const t = useTranslations("downloadButton");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_URL}${file.downloadUrl}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message ?? t("statusError", { status: response.status }));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on the next tick: revoking synchronously can cancel the
      // download in some browsers before it has read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("downloadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        className={className}
        onClick={() => void download()}
        disabled={busy}
        data-testid="download-file"
      >
        {busy ? t("downloading") : (label ?? t("download"))}
      </button>
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
