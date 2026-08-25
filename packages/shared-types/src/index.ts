// Contracts shared between apps/web (Next.js) and apps/api (NestJS).
// Keep this package free of framework-specific imports — it must stay
// importable from both a browser bundle and a Node server.

export type UserRole = "buyer" | "seller" | "admin";

export interface CatalogItemDto {
  id: string;
  kind: "course" | "product" | "book";
  title: string;
  priceUah: number;
  sellerId: string;
}
