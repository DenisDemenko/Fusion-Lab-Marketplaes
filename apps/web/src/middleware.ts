import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API proxying, Next internals, and static files — a middleware
  // that ran on every asset request would add latency for no benefit,
  // since none of those paths are ever locale-prefixed.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
