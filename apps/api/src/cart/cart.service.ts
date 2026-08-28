import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatUah } from '../common/money';
import { toListingCard } from '../catalog/listing.mapper';

const cartInclude = {
  items: {
    include: {
      listing: { include: { seller: true, category: true, media: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.render(await this.ensureCart(userId));
  }

  async addItem(userId: string, listingId: string, quantity = 1) {
    const cart = await this.ensureCart(userId);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing || listing.status !== 'published') {
      throw new NotFoundException('Такого лістингу немає в каталозі');
    }

    // Digital goods are entitlements, not stock: owning one twice means
    // nothing, and a second purchase would take money for access the buyer
    // already has. Physical products are the only thing with a quantity.
    const digital = listing.kind !== 'product';

    if (digital) {
      const owned = await this.prisma.entitlement.findUnique({
        where: { userId_listingId: { userId, listingId } },
      });

      if (owned) {
        throw new ConflictException(
          'Ви вже маєте доступ до цього — шукайте його в розділі «Мої матеріали»',
        );
      }
    }

    const requested = digital ? 1 : Math.max(1, quantity);
    this.assertStock(listing.stock, requested);

    await this.prisma.cartItem.upsert({
      where: { cartId_listingId: { cartId: cart.id, listingId } },
      create: { cartId: cart.id, listingId, quantity: requested },
      update: digital
        ? { quantity: 1 }
        : { quantity: { increment: requested } },
    });

    return this.render(await this.ensureCart(userId));
  }

  async setQuantity(userId: string, listingId: string, quantity: number) {
    const cart = await this.ensureCart(userId);
    const item = cart.items.find((row) => row.listingId === listingId);

    if (!item) {
      throw new NotFoundException('Цієї позиції немає в кошику');
    }

    if (quantity <= 0) {
      return this.removeItem(userId, listingId);
    }

    if (item.listing.kind !== 'product' && quantity > 1) {
      throw new BadRequestException(
        'Цифровий товар купується один раз — кількість завжди 1',
      );
    }

    this.assertStock(item.listing.stock, quantity);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return this.render(await this.ensureCart(userId));
  }

  async removeItem(userId: string, listingId: string) {
    const cart = await this.ensureCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id, listingId },
    });

    return this.render(await this.ensureCart(userId));
  }

  async clear(userId: string) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.render(await this.ensureCart(userId));
  }

  // Used by checkout, which needs the rows themselves rather than the
  // rendered view.
  async requireNonEmpty(userId: string): Promise<CartWithItems> {
    const cart = await this.ensureCart(userId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Кошик порожній');
    }

    return cart;
  }

  private assertStock(stock: number | null, requested: number) {
    if (stock !== null && requested > stock) {
      throw new BadRequestException(
        stock === 0
          ? 'Товару немає в наявності'
          : `В наявності лише ${stock} шт.`,
      );
    }
  }

  private async ensureCart(userId: string): Promise<CartWithItems> {
    // upsert rather than findFirst-then-create: two tabs adding to an
    // empty cart at once would otherwise race and one would get a unique
    // constraint violation instead of a cart.
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: cartInclude,
    });
  }

  private render(cart: CartWithItems) {
    const items = cart.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      lineTotalMinor: item.listing.priceMinor * item.quantity,
      listing: toListingCard(item.listing),
    }));

    const subtotalMinor = items.reduce(
      (sum, item) => sum + item.lineTotalMinor,
      0,
    );

    return {
      id: cart.id,
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalMinor,
      totalMinor: subtotalMinor,
      totalLabel: formatUah(subtotalMinor),
      currency: 'UAH',
    };
  }
}
