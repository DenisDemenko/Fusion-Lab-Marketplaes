import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Nova (Book_Creality) під /studio на цьому ж домені — Фаза G3
// (docs/migration-plan.md). Причина саме префікса шляху, а не піддомена:
// браузер тримає стан входу Firebase окремо для кожного origin, тож спільна
// сесія між маркетплейсом і Nova (Фаза G2) можлива лише тоді, коли обидва
// застосунки на одному origin. `studio.fusionlab.in.ua` дав би окремий
// origin і зламав би саме те, заради чого це робиться.
//
// Префікс тут зрізається: Nova отримує /api/..., а не /studio/api/..., тож
// її серверний бік не змінюється взагалі. Префікс додає лише клієнт Nova —
// див. src/utils/basePath.ts у тому репозиторії.
//
// WebSocket сюди не входить: rewrite Vercel не проксує upgrade-з'єднання,
// тож спільне редагування книг у Nova ходить напряму на її власний хост
// (VITE_NOVA_WS_URL). Крос-оригінний WebSocket — це нормально, на нього не
// діє правило одного походження; сервер сам перевіряє Origin.
//
// Без NOVA_ORIGIN rewrite не додається — локальна розробка маркетплейсу
// працює як і раніше, без спроб проксувати неіснуючий сервіс.
const novaOrigin = process.env.NOVA_ORIGIN?.replace(/\/$/, "");

// Друкується в Build Logs Vercel. Раніше відсутність NOVA_ORIGIN нічим не
// проявлялася: rewrites() мовчки повертав [], збірка вважалась успішною, а
// /studio віддавав 404 — і ззовні неможливо було відрізнити «змінна не
// дійшла до збірки» від «правило програло маршрутизації». Один рядок у
// логу знімає це питання назавжди.
console.log(
  novaOrigin
    ? `[next.config] NOVA_ORIGIN = ${novaOrigin} — rewrite /studio увімкнено`
    : "[next.config] NOVA_ORIGIN не заданий — /studio НЕ проксується в Nova"
);

const nextConfig: NextConfig = {
  // Дефолтний trailingSlash-редирект Next.js спрацьовує РАНІШЕ за
  // beforeFiles-rewrite вище: /studio/about/ (зі скісною, на яку
  // Nova навмисно шле через <meta refresh> — див. коментар над
  // app.get(['/about','/about/']) у server.ts Book_Creality)
  // 308-редиректилось на /studio/about (без скісної), той знову
  // віддавав transitional-сторінку з переходом на "about/" — і цикл
  // повторювався нескінченно. skipTrailingSlashRedirect вимикає
  // цей редирект для всього застосунку — офіційний обхідний шлях
  // Next.js саме для проксі-rewrite на чужий origin:
  // https://nextjs.org/docs/app/api-reference/next-config-js/skipTrailingSlashRedirect
  skipTrailingSlashRedirect: true,
  async rewrites() {
    if (!novaOrigin) return { beforeFiles: [], afterFiles: [], fallback: [] };

    // Саме beforeFiles, а не короткий масив (він рівнозначний afterFiles):
    // весь маркетплейс живе під динамічним сегментом app/[locale]/, який
    // теж готовий підхопити /studio — як «локаль» з назвою studio — і
    // віддати 404. Саме це показував заголовок відповіді
    // `X-Matched-Path: /[locale]`. beforeFiles виконується до маршрутів
    // застосунку, тож префікс дістається Nova незалежно від того, що
    // з'явиться всередині [locale] згодом.
    return {
      beforeFiles: [
        { source: "/studio", destination: novaOrigin },
        { source: "/studio/:path*", destination: `${novaOrigin}/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withNextIntl(nextConfig);
