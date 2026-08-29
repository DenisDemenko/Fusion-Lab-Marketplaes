"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Opening a thread and navigating to it in one click — the actual message
// gets typed on the chat page itself, which already knows how to render
// history for a thread that has none yet.
export function MessageSellerButton({ listingId }: { listingId: string }) {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openChat() {
    if (!firebaseUser) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const thread = await api.post<{ id: string }>("/chat/threads", { listingId });
      router.push(`/chat/${thread.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Не вдалося відкрити чат",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn-ghost w-full" onClick={() => void openChat()} disabled={busy}>
        {busy ? "Відкриваю…" : "Написати продавцю"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
