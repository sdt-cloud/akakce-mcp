import type { AktuelBrochure, AktuelProduct } from '../mcp/types';

export function getProductsForBrochure(
  brochure: AktuelBrochure,
  products: AktuelProduct[],
): AktuelProduct[] {
  const bySource = products.filter(
    (p) => p.market === brochure.market && p.sourceUrl === brochure.sourceUrl,
  );
  if (bySource.length > 0) return bySource;

  if (brochure.market === 'bim') {
    if (brochure.id === 'bim-afis-guncel') {
      const activeBim = products.filter((p) => p.market === 'bim' && p.timingStatus === 'aktif');
      if (activeBim.length > 0) return activeBim;
    }
    const byDate = products.filter(
      (p) => p.market === 'bim' && p.validFrom === brochure.validFrom,
    );
    if (byDate.length > 0) return byDate;
    if (brochure.productCount > 0) {
      return products.filter((p) => p.market === 'bim');
    }
  }

  return [];
}

export function findBrochureForProduct(
  product: AktuelProduct,
  brochures: AktuelBrochure[],
): AktuelBrochure | null {
  const exact = brochures.find(
    (b) =>
      b.pageImages.length > 0 &&
      b.market === product.market &&
      b.sourceUrl === product.sourceUrl,
  );
  if (exact) return exact;

  if (product.market === 'bim') {
    const byDate = brochures.find(
      (b) => b.pageImages.length > 0 && b.market === 'bim' && b.validFrom === product.validFrom,
    );
    if (byDate) return byDate;
    const guncel = brochures.find(
      (b) => b.pageImages.length > 0 && b.id === 'bim-afis-guncel',
    );
    if (guncel) return guncel;
  }

  return null;
}
