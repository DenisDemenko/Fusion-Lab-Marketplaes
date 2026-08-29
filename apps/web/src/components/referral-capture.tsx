"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";

export const REFERRAL_STORAGE_KEY = "fusionlab_referral_code";

// Called once, right after a successful sign-up (and, best-effort, after
// Google sign-in — which cannot tell a brand-new account from a returning
// one at the client). The backend is the real gate: it silently no-ops a
// self-referral, a duplicate claim, or a claim from someone who already
// bought something, so calling this on a returning user just fails quietly
// instead of needing to be told not to.
export async function claimStoredReferral(): Promise<void> {
  let code: string | null = null;
  try {
    code = localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return;
  }

  if (!code) return;

  try {
    await api.post("/referrals/claim", { code });
  } catch {
    // Expected for a self-referral, a duplicate, or a returning user —
    // none of these are worth surfacing to someone who just signed up.
  } finally {
    try {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    } catch {
      /* private browsing — nothing to clean up */
    }
  }
}

// Invisible: just remembers a ?ref=CODE seen anywhere on the site until
// signup claims it (see login/page.tsx). A visitor following a referral
// link almost never lands directly on /login — they hit the home page or
// a shared listing link first — so capture has to happen globally, not
// just on the signup form.
export function ReferralCapture() {
  return (
    <Suspense fallback={null}>
      <CaptureFromQuery />
    </Suspense>
  );
}

function CaptureFromQuery() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("ref");
    if (!code) return;

    try {
      // Never overwrite an already-stored code with a new link click: the
      // first invite someone actually followed is the one that should get
      // credit if they click several before signing up.
      if (!localStorage.getItem(REFERRAL_STORAGE_KEY)) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, code);
      }
    } catch {
      // Private browsing / storage disabled — referral capture just does
      // not work this session, which is not worth interrupting anything.
    }
  }, [searchParams]);

  return null;
}
