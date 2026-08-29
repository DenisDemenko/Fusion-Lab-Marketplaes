"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authErrorMessage, useAuth } from "@/lib/auth-context";
import { claimStoredReferral } from "@/components/referral-capture";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        await claimStoredReferral();
      }
      router.push(next);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="section-title">
        {mode === "signin" ? "Вхід" : "Реєстрація"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Акаунт потрібен, щоб купувати, завантажувати матеріали й продавати.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="email">
            Пошта
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Хвилинку…" : mode === "signin" ? "Увійти" : "Створити акаунт"}
        </button>

        <button
          type="button"
          className="btn-ghost w-full"
          onClick={async () => {
            setError(null);
            try {
              await signInWithGoogle();
              await claimStoredReferral();
              router.push(next);
            } catch (caught) {
              setError(authErrorMessage(caught));
            }
          }}
        >
          Увійти через Google
        </button>

        <p className="text-center text-sm text-zinc-500">
          {mode === "signin" ? "Ще немає акаунта?" : "Вже маєте акаунт?"}{" "}
          <button
            type="button"
            className="font-medium text-zinc-900 underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "Зареєструватися" : "Увійти"}
          </button>
        </p>
      </form>
    </div>
  );
}
