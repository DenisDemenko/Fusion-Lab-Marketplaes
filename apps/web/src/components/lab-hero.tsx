"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LightRays } from "./light-rays";

// Ported from site/index.html's <section class="hero"> (docs/migration-
// plan.md Phase C) — sits above the marketplace's own hero (П1: "стає над
// ним"), keeps the lab's original copy and CTAs (П2: "старим"), not the
// marketplace's. hero-facts (equipment/teachers/address strip) is
// deliberately not ported (П4/C6) — that's about the physical space, not
// the storefront below it.
//
// CTA destinations are a judgment call, not in the original plan: there is
// no booking page yet (that's Phase F2) and no standalone "напрямки" page
// in the marketplace, so "Записатися на спільне заняття" points at the
// course catalog and "Переглянути напрямки" scrolls to the category strip
// already on this same homepage, below the fold. Both should be repointed
// once F2/F3 exist — see docs/migration-plan.md, "Відкриті питання".
export function LabHero() {
  const t = useTranslations("labHero");
  const sectionRef = useRef<HTMLDivElement>(null);

  // The "dynamic fill" from П3: instead of a fixed left-to-right gradient
  // that washes the whole portrait in brown, the overlay's hotspot follows
  // the pointer, and its own opacity is lower than the original (0.88 max
  // here vs the source's 0.88 uniform) so the right side — where the
  // portrait's face sits — reads clearly even before anyone moves the
  // mouse.
  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  }

  return (
    <section
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      className="relative isolate overflow-hidden bg-[#2b1a10]"
      style={{ "--mx": "30%", "--my": "40%" } as React.CSSProperties}
    >
      <div className="absolute inset-0">
        <picture>
          <source srcSet="/hero-lab.avif" type="image/avif" />
          <source srcSet="/hero-lab.webp" type="image/webp" />
          <img
            src="/hero-lab.webp"
            alt=""
            className="h-full w-full object-cover object-top"
            fetchPriority="high"
          />
        </picture>
        {/* Two layers: a soft base wash (lighter than the original site's,
            and now anchored to the pointer's x position rather than a
            fixed diagonal) plus a brighter radial "clearing" right where
            the pointer is, so the image never reads as uniformly brown. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(43,26,16,.82) 0%, rgba(43,26,16,.6) var(--mx), rgba(43,26,16,.22) 100%)",
          }}
        />
        <div
          className="absolute inset-0 transition-[background] duration-300 ease-out"
          style={{
            background:
              "radial-gradient(38rem circle at var(--mx) var(--my), rgba(43,26,16,0) 0%, rgba(43,26,16,.35) 70%)",
          }}
        />
      </div>

      <LightRays />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-xl">
          <p className="text-sm font-medium tracking-wide text-[#e7b78f]">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
            {t.rich("title", {
              br: () => <br />,
            })}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[#eadfd3] sm:text-lg">
            {t("body")}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/catalog?kind=course" className="btn-accent">
              {t("ctaBook")}
            </Link>
            <a href="#categories" className="btn-ghost !bg-white/10 !text-white !border-white/25 hover:!bg-white/20">
              {t("ctaDirections")}
            </a>
            <Link href="/login" className="btn-ghost !bg-transparent !text-white !border-white/40 hover:!bg-white/10">
              {t("ctaSignIn")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
