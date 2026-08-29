"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AssistantReply } from "@fusion-lab/shared-types";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";

interface ChatLine {
  role: "user" | "assistant";
  text: string;
  suggestions?: AssistantReply["suggestions"];
}

// Deliberately available to anonymous visitors: "який курс мені підійде?"
// is a question people ask before they create an account.
//
// Note on scope: only this widget's own chrome (button, header, opening
// line, error fallback) is translated here. The assistant's actual
// replies come from the API (AssistantService) in Ukrainian regardless of
// UI locale — teaching the backend's catalogue-grounded answers and its
// Claude prompt to speak English is a separate, considerably larger
// change than the next-intl/[locale] routing this task scopes.
export function AssistantWidget() {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([
    { role: "assistant", text: t("openingLine") },
  ]);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;

    setLines((current) => [...current, { role: "user", text }]);
    setMessage("");
    setBusy(true);

    try {
      const reply = await api.post<AssistantReply>("/assistant/chat", {
        message: text,
        threadId,
      });

      setThreadId(reply.threadId);
      setLines((current) => [
        ...current,
        {
          role: "assistant",
          text: reply.reply,
          suggestions: reply.suggestions,
        },
      ]);
    } catch {
      setLines((current) => [
        ...current,
        { role: "assistant", text: t("connectionFailed") },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-accent fixed bottom-5 right-5 z-40 shadow-lg"
        data-testid="assistant-open"
      >
        {t("openButton")}
      </button>
    );
  }

  return (
    <div className="card fixed bottom-5 right-5 z-40 flex h-[32rem] w-[22rem] flex-col overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-zinc-500">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          onClick={() => setOpen(false)}
          aria-label={t("close")}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {lines.map((line, index) => (
          <div
            key={index}
            className={line.role === "user" ? "text-right" : "text-left"}
          >
            <p
              className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                line.role === "user"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {line.text}
            </p>

            {line.suggestions?.length ? (
              <ul className="mt-2 space-y-1.5">
                {line.suggestions.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/catalog/${item.slug}`}
                      className="block rounded-xl border border-[var(--line)] px-3 py-2 text-left text-sm hover:bg-zinc-50"
                      onClick={() => setOpen(false)}
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="block text-xs text-zinc-500">
                        {item.priceLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {busy ? <p className="text-sm text-zinc-400">{t("thinking")}</p> : null}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-[var(--line)] p-3">
        <input
          className="input"
          placeholder={t("inputPlaceholder")}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-label={t("inputLabel")}
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          →
        </button>
      </form>
    </div>
  );
}
