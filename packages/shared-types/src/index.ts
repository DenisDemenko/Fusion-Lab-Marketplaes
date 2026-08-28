// Contracts shared between apps/web (Next.js) and apps/api (NestJS).
// Keep this package free of framework-specific imports — it must stay
// importable from both a browser bundle and a Node server.
//
// These mirror what the API's mappers actually return (see
// apps/api/src/catalog/listing.mapper.ts). Money is always integer minor
// units (копійки); every `*Label` field is the same number preformatted by
// the server, so the two sides can never disagree on rounding.

export type UserRole = "buyer" | "seller" | "admin";
export type SellerStatus = "pending" | "approved" | "rejected";
export type ListingKind = "course" | "product" | "book";
export type ListingStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";
export type MediaKind = "cover" | "attachment" | "video";
export type MediaAccess = "public" | "entitled";

export interface SellerSummary {
  id: string;
  displayName: string;
  slug: string;
}

export interface CategorySummary {
  slug: string;
  name: string;
  listingCount?: number;
}

export interface MediaSummary {
  id: string;
  kind: MediaKind;
  access: MediaAccess;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadCount: number;
  downloadUrl: string;
  createdAt: string;
}

export interface ListingCard {
  id: string;
  slug: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  subtitle: string | null;
  summary: string | null;
  priceMinor: number;
  priceLabel: string;
  currency: string;
  coverUrl: string | null;
  stock: number | null;
  highlights: string[];
  publishedAt: string | null;
  createdAt: string;
  seller: SellerSummary | null;
  category: CategorySummary | null;
}

export interface CourseLesson {
  title: string;
  goal?: string;
  topics?: string[];
  practice?: string;
  project?: string;
}

export interface CourseModule {
  title: string;
  lessons?: CourseLesson[];
}

export interface Curriculum {
  targetAudience?: string[];
  results?: string[];
  includes?: string[] | string | null;
  duration?: string | null;
  format?: string | null;
  modules?: CourseModule[];
}

export interface ListingDetail extends ListingCard {
  description: string | null;
  curriculum: Curriculum | null;
  externalSource: string | null;
  media: MediaSummary[];
  // Paid files: listed so a buyer knows what they get, deliberately
  // without a download URL until an entitlement exists.
  lockedMedia: Pick<
    MediaSummary,
    "id" | "kind" | "filename" | "mimeType" | "sizeBytes"
  >[];
}

// What a seller sees of their own listing — unlike ListingDetail (built for
// a buyer who has not paid), the owner gets full MediaSummary for every
// file, split by role rather than by access level, so the cabinet can show
// size, download counts, and offer deletion on every one of them.
export interface SellerListingDetail extends ListingCard {
  description: string | null;
  curriculum: Curriculum | null;
  externalSource: string | null;
  rejectionReason: string | null;
  cover: MediaSummary | null;
  attachments: MediaSummary[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface CartLine {
  id: string;
  quantity: number;
  lineTotalMinor: number;
  listing: ListingCard;
}

export interface Cart {
  id: string;
  items: CartLine[];
  count: number;
  subtotalMinor: number;
  totalMinor: number;
  totalLabel: string;
  currency: string;
}

export interface OrderLine {
  id: string;
  title: string;
  kind: ListingKind;
  listingId: string;
  listingSlug: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  totalLabel: string;
  commissionMinor: number;
  createdAt: string;
  paidAt: string | null;
  payment: {
    provider: string;
    status: string;
    providerPaymentId: string | null;
  } | null;
  items: OrderLine[];
}

// What the frontend needs to send a buyer to LiqPay. When `configured` is
// false there are no gateway keys in this environment, and the demo
// confirmation endpoint takes over.
export type CheckoutPayment =
  | { provider: "liqpay"; configured: false; message: string }
  | {
      provider: "liqpay";
      configured: true;
      data: string;
      signature: string;
      actionUrl: string;
    };

export interface LibraryEntry {
  id: string;
  grantedAt: string;
  orderNumber: string | null;
  listing: ListingCard;
  files: MediaSummary[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  seller: {
    id: string;
    slug: string;
    displayName: string;
    status: SellerStatus;
  } | null;
}

export interface SellerProfile {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  status: SellerStatus;
  commissionPercent: number;
  stats: {
    listingsByStatus: Partial<Record<ListingStatus, number>>;
    itemsSold: number;
    grossMinor: number;
    commissionMinor: number;
    payoutMinor: number;
  };
}

export interface SellerSale {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  placedAt: string;
  paidAt: string | null;
  title: string;
  listingSlug: string;
  quantity: number;
  unitPriceMinor: number;
  commissionMinor: number;
  payoutMinor: number;
}

export interface AdminStats {
  users: number;
  sellersPending: number;
  listingsPending: number;
  listingsPublished: number;
  paidOrders: number;
  grossMinor: number;
  grossLabel: string;
  commissionMinor: number;
  commissionLabel: string;
}

export interface AssistantReply {
  threadId: string;
  reply: string;
  source: "llm" | "catalog";
  suggestions: ListingCard[];
}
