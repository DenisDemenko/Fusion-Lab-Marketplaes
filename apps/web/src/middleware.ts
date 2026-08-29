import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API proxying, Next internals, and static files — a middleware
  // that ran on every asset request would add latency for no benefit,
  // since none of those paths are ever locale-prefixed.
  //
  // `studio` is excluded for a different reason: it is not a page of this
  // app at all but Nova (Book_Creality), proxied in by the rewrite in
  // next.config.ts (docs/migration-plan.md Phase G3). Without this the
  // i18n middleware claims the path first and tries to locale-prefix it,
  // so /studio 404s before the rewrite is ever reached — Nova has its own
  // language switcher and never wants a /uk or /en prefix.
  matcher: ["/((?!api|studio|_next|_vercel|.*\\..*).*)"],
};
