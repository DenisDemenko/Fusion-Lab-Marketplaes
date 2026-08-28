"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type { Notification } from "@fusion-lab/shared-types";
import { API_URL, api } from "./api-client";
import { auth } from "./firebase";
import { useAuth } from "./auth-context";

interface NotificationsState {
  items: Notification[];
  unread: number;
  connected: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

// REST is the source of truth; the socket only makes new items appear
// without a reload. That order matters: a dropped websocket (sleeping tab,
// proxy that kills idle upgrades) then costs nothing but immediacy.
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!firebaseUser) {
      setItems([]);
      setUnread(0);
      return;
    }

    try {
      const response = await api.get<{
        items: Notification[];
        unread: number;
      }>("/notifications");
      setItems(response.items);
      setUnread(response.unread);
    } catch {
      // Same reasoning as CartProvider.refresh: a background sync failure
      // (expired token, network blip) must not surface as an unhandled
      // rejection — the bell just keeps its last known state.
    }
  }, [firebaseUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!firebaseUser) return;

    let socket: Socket | undefined;
    let cancelled = false;

    // A websocket carries no Authorization header, so the same Firebase ID
    // token goes in the handshake (see NotificationsGateway).
    void auth.currentUser?.getIdToken().then((token) => {
      if (cancelled || !token) return;

      socket = io(`${API_URL}/notifications`, {
        auth: { token },
        transports: ["websocket"],
      });

      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("notification", (notification: Notification) => {
        setItems((current) => [notification, ...current].slice(0, 50));
        setUnread((current) => current + 1);
      });
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
      setConnected(false);
    };
  }, [firebaseUser]);

  const value = useMemo<NotificationsState>(
    () => ({
      items,
      unread,
      connected,
      markRead: async (id) => {
        await api.post(`/notifications/${id}/read`);
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
        setUnread((current) => Math.max(0, current - 1));
      },
      markAllRead: async () => {
        await api.post("/notifications/read-all");
        const now = new Date().toISOString();
        setItems((current) =>
          current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
        );
        setUnread(0);
      },
      refresh,
    }),
    [items, unread, connected, refresh],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used inside <NotificationsProvider>");
  }
  return context;
}
