"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import type { CurrentUser } from "@fusion-lab/shared-types";
import { auth } from "./firebase";
import { api } from "./api-client";

interface AuthState {
  firebaseUser: User | null;
  // The marketplace's view of the account: role, seller status. Firebase
  // knows none of that, so every screen that branches on permissions waits
  // for this, not for the Firebase user.
  profile: CurrentUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<CurrentUser | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return null;
    }

    try {
      const me = await api.get<CurrentUser>("/me");
      setProfile(me);
      return me;
    } catch {
      // Signed in with Firebase but the API refused or is down. Staying
      // signed-in-without-a-profile is the honest state: the header shows
      // the account, and protected pages say what is wrong.
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      void refreshProfile().finally(() => setLoading(false));
    });
  }, [refreshProfile]);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      profile,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
        await refreshProfile();
      },
      signUp: async (email, password) => {
        await createUserWithEmailAndPassword(auth, email, password);
        await refreshProfile();
      },
      signInWithGoogle: async () => {
        await signInWithPopup(auth, new GoogleAuthProvider());
        await refreshProfile();
      },
      signOut: async () => {
        await firebaseSignOut(auth);
        setProfile(null);
      },
      refreshProfile,
    }),
    [firebaseUser, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

// Firebase's error codes are not something to show a person. Anything
// unmapped falls through with its own message rather than a generic one,
// so an unexpected failure stays diagnosable.
export function authErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Невірна пошта або пароль";
    case "auth/email-already-in-use":
      return "Такий акаунт уже існує — увійдіть замість реєстрації";
    case "auth/weak-password":
      return "Пароль закороткий: щонайменше 6 символів";
    case "auth/invalid-email":
      return "Перевірте адресу пошти";
    case "auth/popup-closed-by-user":
      return "Вікно Google закрито — вхід не завершено";
    case "auth/network-request-failed":
      return "Немає зв'язку з сервером автентифікації";
    default:
      return error instanceof Error ? error.message : "Не вдалося увійти";
  }
}
