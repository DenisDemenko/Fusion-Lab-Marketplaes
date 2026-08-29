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
  // Publish inside Nova — make a book or instruction visible in the catalog.
  'publishing:nova',
  // External marketplaces: Amazon KDP and Etsy, including the OAuth shop
  // connection. Separate from keys:manage on purpose: an Etsy token is
  // issued by Etsy and stored encrypted by us, while a provider key is a
  // third-party credential the user types in. Different trust boundaries,
  // so a sales manager can connect a shop without touching AI keys.
  'publishing:external',
  // Spend paid image generations. Real money per call, hence its own
  // permission rather than riding along with books:write.
  'images:generate',
  // Enter *own* secret AI provider keys. Withheld from instruction_engineer
  // and student by design — Nova serves them on its own keys (Phase H4).
  'keys:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

// One preset per role. `admin` is listed explicitly (not "all of
// PERMISSIONS" computed) so a new permission added later doesn't silently
// become admin-only-by-omission — it has to be added here on purpose.
//
// The full matrix lives in docs/migration-plan.md §H1 and is meant to be
// adjusted there first — this object is its executable half.
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  buyer: [],
  seller: ['listings:write'],
  admin: [
    'listings:write',
    'sales:access',
    'books:write',
    'publishing:nova',
    'publishing:external',
    'images:generate',
    'keys:manage',
  ],
  // Письменник = пише + права менеджера продажів (docs/migration-plan.md, П16).
  // Deliberately a superset of sales_manager: delegating sales does not cost
  // the writer the ability to do it personally.
  writer: [
    'books:write',
    'sales:access',
    'publishing:nova',
    'publishing:external',
    'images:generate',
    'keys:manage',
  ],
  // Creates courses through the existing seller listing form (Phase A
  // scope) — a dedicated course-builder UI is its own deferred package.
  expert: ['listings:write'],
  // Invite-only (see SELF_SELECTABLE_ROLES). Publishes on the writer's
  // behalf, inside Nova and on KDP/Etsy, but never authors text and never
  // touches provider keys.
  sales_manager: ['sales:access', 'publishing:nova', 'publishing:external'],
  // Phase H3: identical presets on purpose — these two roles differ in quota
  // and future differentiation, not in what they may do. Neither gets
  // keys:manage (H4) nor publishing:external, which stays a writer/sales
  // privilege.
  instruction_engineer: ['books:write', 'publishing:nova', 'images:generate'],
  student: ['books:write', 'publishing:nova', 'images:generate'],
};

// Roles a user may assign to themselves via POST /me/role. Everything else
// is granted by the system: `admin` by seeding or another admin,
// `sales_manager` only by accepting a writer's emailed invite (Phase H2).
// Keeping this as an allowlist rather than a denylist means a role added
// later is un-self-selectable until someone decides otherwise.
export const SELF_SELECTABLE_ROLES: readonly UserRole[] = [
  'buyer',
  'seller',
  'writer',
  'expert',
  'instruction_engineer',
  'student',
];

export function isSelfSelectableRole(role: UserRole): boolean {
  return SELF_SELECTABLE_ROLES.includes(role);
}

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
