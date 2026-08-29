import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware replacements for next/link and next/navigation — every
// page in this app imports Link/useRouter/redirect from here instead, so
// a navigation never accidentally drops the current locale prefix.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
