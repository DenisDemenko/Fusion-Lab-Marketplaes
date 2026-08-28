import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogQueryDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

// Public, unauthenticated: the catalog is the shop window. Everything it
// returns is either published or derived from published rows.
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  search(@Query() query: CatalogQueryDto) {
    return this.catalog.search(query);
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('sellers')
  sellers() {
    return this.catalog.sellers();
  }

  // Declared last: "categories" and "sellers" would otherwise be captured
  // by :slug, which Nest matches in declaration order.
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.catalog.findBySlug(slug);
  }
}
