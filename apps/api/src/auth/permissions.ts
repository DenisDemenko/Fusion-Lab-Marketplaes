import { UserRole } from '@prisma/client';

// Fixed, code-defined catalog — not a DB table, unlike the roles above it.
// Nothing in this system lets an admin invent a new permission string at
// runtime; only *who holds* an existing one is dynamic (see
// UserPermissionOverride). Keeping the catalog closed means a typo in an
// override's `permission` column is silently inert instead of quietly
// creating a permission nobody checks for.
export const PERMISSIONS = [
  // Create/edit listings in the seller cabinet — courses, products, books.
  'listings:write',
  // Own storefront section: cart, own orders, own products. Gated by
  // User.salesApproved regardless of role preset — see effectivePermissions.
  'sales:access',
  // Write/edit books in the Book_Creality integration (Phase G).
  'books:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

// One preset per role. `admin` is listed explicitly (not "all of
// PERMISSIONS" computed) so a new permission added later doesn't silently
// become admin-only-by-omission — it has to be added here on purpose.
//
// instruction_engineer and student are intentionally empty: their rights
// are an open question in docs/migration-plan.md (§Відкриті питання) and
// are meant to be filled in via UserPermissionOverride per-user until a
// preset is agreed, not guessed at here.
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  buyer: [],
  seller: ['listings:write'],
  admin: ['listings:write', 'sales:access', 'books:write'],
  // Письменник = пише + права менеджера продажів (docs/migration-plan.md, П16).
  writer: ['books:write', 'sales:access'],
  // Creates courses through the existing seller listing form (Phase A
  // scope) — a dedicated course-builder UI is its own deferred package.
  expert: ['listings:write'],
  sales_manager: ['sales:access'],
  instruction_engineer: [],
  student: [],
};

type PermissionOverride = { permission: string; granted: boolean };

// The single source of truth for "can this user do X" — every guard and
// every UI affordance should ask this, not read `user.role` directly, so
// there is exactly one place the sales-approval gate and override
// semantics live.
export function effectivePermissions(user: {
  role: UserRole;
  salesApproved: boolean;
  permissionOverrides: PermissionOverride[];
}): Set<Permission> {
  const effective = new Set<Permission>(ROLE_PERMISSIONS[user.role]);

  // A role preset can *offer* sales:access, but it only takes effect once
  // an admin has approved this specific person — the same trust boundary
  // SellerProfile.status already enforces for sellers. Without this, a
  // freely self-chosen role (writer, sales_manager) would grant access to
  // other people's orders/cart data with zero admin involvement. Admin
  // itself is exempt: the role already means "fully trusted", and
  // salesApproved defaults to false for every account including admins
  // created by the seed script.
  if (
    effective.has('sales:access') &&
    !user.salesApproved &&
    user.role !== 'admin'
  ) {
    effective.delete('sales:access');
  }

  // Overrides apply last and always win, in both directions: they can
  // grant something the role preset withholds, or revoke something it
  // grants (including sales:access itself, independent of salesApproved —
  // an explicit `granted:false` override is a stronger statement than
  // "not yet approved").
  for (const override of user.permissionOverrides) {
    if (!isPermission(override.permission)) continue;
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }

  return effective;
}
