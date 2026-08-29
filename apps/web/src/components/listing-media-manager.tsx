"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { MediaKind, MediaSummary } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { api, mediaUrl } from "@/lib/api-client";
import { formatBytes } from "@/lib/format";

// Handles both roles a file can play on a listing: the one public cover
// image, and any number of paid attachments. Upload and delete both
// happen immediately (no "save" step) because a listing's files are only
// meaningful once they exist in storage — there is no draft state for a
// binary blob worth having.
export function ListingMediaManager({
  listingId,
  cover,
  attachments,
  onChange,
}: {
  listingId: string;
  cover: MediaSummary | null;
  attachments: MediaSummary[];
  onChange: () => void;
}) {
  const t = useTranslations("mediaManager");

  return (
    <div className="space-y-6">
      <div>
        <p className="label">{t("cover")}</p>
        <CoverUploader listingId={listingId} cover={cover} onChange={onChange} />
      </div>

      <div>
        <p className="label">{t("filesForBuyers")}</p>
        <AttachmentUploader
          listingId={listingId}
          attachments={attachments}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function CoverUploader({
  listingId,
  cover,
  onChange,
}: {
  listingId: string;
  cover: MediaSummary | null;
  onChange: () => void;
}) {
  const t = useTranslations("mediaManager");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverImage = mediaUrl(cover?.downloadUrl);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("kind", "cover" satisfies MediaKind);
      formData.append("file", file);
      await api.upload(`/seller/listings/${listingId}/media`, formData);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("coverUploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-zinc-50">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-zinc-400">
            {t("none")}
          </div>
        )}
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("uploading") : cover ? t("replaceCover") : t("uploadCover")}
        </button>
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}

function AttachmentUploader({
  listingId,
  attachments,
  onChange,
}: {
  listingId: string;
  attachments: MediaSummary[];
  onChange: () => void;
}) {
  const t = useTranslations("mediaManager");
  const locale = useLocale() as Locale;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("kind", "attachment" satisfies MediaKind);
      formData.append("access", "entitled");
      formData.append("file", file);
      await api.upload(`/seller/listings/${listingId}/media`, formData);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("fileUploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(mediaId: string) {
    try {
      await api.delete(`/seller/media/${mediaId}`);
      onChange();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("deleteFailed"));
    }
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 ? (
        <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">
                  {file.filename}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatBytes(file.sizeBytes, locale)} ·{" "}
                  {t("downloadsCount", { count: file.downloadCount })}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-sm text-red-700 hover:underline"
                onClick={() => void remove(file.id)}
              >
                {t("delete")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{t("noFilesYet")}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        className="btn-ghost"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? t("uploading") : t("addFile")}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
