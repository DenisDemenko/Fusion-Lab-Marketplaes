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

const nextConfig: NextConfig = {
  async rewrites() {
    if (!novaOrigin) return [];

    return [
      { source: "/studio", destination: novaOrigin },
      { source: "/studio/:path*", destination: `${novaOrigin}/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
