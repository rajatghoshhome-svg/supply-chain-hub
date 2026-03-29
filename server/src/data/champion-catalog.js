// ─────────────────────────────────────────────────────────────────────────────
// Champion Pet Foods — Product Catalog & Hierarchy
// 2 brands (ORIJEN, ACANA), ~65 SKUs with real product names
// Hierarchy: Brand → Family → Line → Product → SKU (size variant)
// ─────────────────────────────────────────────────────────────────────────────

export const brands = [
  { id: 'ORIJEN', name: 'ORIJEN', color: '#C8102E' },
  { id: 'ACANA', name: 'ACANA', color: '#00563F' },
];

export const families = [
  // ORIJEN families
  { id: 'ORI-DOG-DRY', brandId: 'ORIJEN', name: 'Orijen Dry Dog Food', species: 'dog', format: 'dry' },
  { id: 'ORI-CAT-DRY', brandId: 'ORIJEN', name: 'Orijen Dry Cat Food', species: 'cat', format: 'dry' },
  { id: 'ORI-FD',      brandId: 'ORIJEN', name: 'Orijen Freeze-Dried', species: 'dog', format: 'freeze-dried' },
  { id: 'ORI-TREAT',   brandId: 'ORIJEN', name: 'Orijen Treats', species: 'dog', format: 'treat' },
  // ACANA families
  { id: 'ACA-DOG-DRY', brandId: 'ACANA', name: 'Acana Dry Dog Food', species: 'dog', format: 'dry' },
  { id: 'ACA-CAT-DRY', brandId: 'ACANA', name: 'Acana Dry Cat Food', species: 'cat', format: 'dry' },
  { id: 'ACA-WET-DOG', brandId: 'ACANA', name: 'Acana Wet Dog Food', species: 'dog', format: 'wet' },
];

export const lines = [
  // ORIJEN Dry Dog
  { id: 'ORI-CORE',  familyId: 'ORI-DOG-DRY', name: 'Orijen Core' },
  { id: 'ORI-AG',    familyId: 'ORI-DOG-DRY', name: 'Orijen Amazing Grains' },
  // ORIJEN Dry Cat
  { id: 'ORI-CAT',   familyId: 'ORI-CAT-DRY', name: 'Orijen Cat' },
  // ORIJEN Freeze-Dried
  { id: 'ORI-FDL',   familyId: 'ORI-FD', name: 'Orijen Freeze-Dried' },
  // ORIJEN Treats
  { id: 'ORI-TRT',   familyId: 'ORI-TREAT', name: 'Orijen Epic Bites' },
  // ACANA Dry Dog
  { id: 'ACA-REG',   familyId: 'ACA-DOG-DRY', name: 'Acana Regionals' },
  { id: 'ACA-HP',    familyId: 'ACA-DOG-DRY', name: 'Acana Highest Protein' },
  { id: 'ACA-SNG',   familyId: 'ACA-DOG-DRY', name: 'Acana Singles' },
  { id: 'ACA-WG',    familyId: 'ACA-DOG-DRY', name: 'Acana Wholesome Grains' },
  // ACANA Dry Cat
  { id: 'ACA-CAT',   familyId: 'ACA-CAT-DRY', name: 'Acana Cat' },
  // ACANA Wet Dog
  { id: 'ACA-WETL',  familyId: 'ACA-WET-DOG', name: 'Acana Premium Chunks' },
];

export const products = [
  // ── ORIJEN Core (9 products) ──
  { id: 'ORI-ORIG',    lineId: 'ORI-CORE', name: 'Original' },
  { id: 'ORI-RRED',    lineId: 'ORI-CORE', name: 'Regional Red' },
  { id: 'ORI-6FISH',   lineId: 'ORI-CORE', name: 'Six Fish' },
  { id: 'ORI-TUNDRA',  lineId: 'ORI-CORE', name: 'Tundra' },
  { id: 'ORI-PUPPY',   lineId: 'ORI-CORE', name: 'Puppy' },
  { id: 'ORI-PUP-LG',  lineId: 'ORI-CORE', name: 'Puppy Large Breed' },
  { id: 'ORI-SM',      lineId: 'ORI-CORE', name: 'Small Breed' },
  { id: 'ORI-SENIOR',  lineId: 'ORI-CORE', name: 'Senior' },
  { id: 'ORI-FIT',     lineId: 'ORI-CORE', name: 'Fit & Trim' },
  // ── ORIJEN Amazing Grains (7 products) ──
  { id: 'ORI-AG-ORIG', lineId: 'ORI-AG', name: 'Amazing Grains Original' },
  { id: 'ORI-AG-6F',   lineId: 'ORI-AG', name: 'Amazing Grains Six Fish' },
  { id: 'ORI-AG-RR',   lineId: 'ORI-AG', name: 'Amazing Grains Regional Red' },
  { id: 'ORI-AG-SM',   lineId: 'ORI-AG', name: 'Amazing Grains Small Breed' },
  { id: 'ORI-AG-FIT',  lineId: 'ORI-AG', name: 'Amazing Grains Fit & Trim' },
  { id: 'ORI-AG-PUP',  lineId: 'ORI-AG', name: 'Amazing Grains Puppy' },
  { id: 'ORI-AG-PLG',  lineId: 'ORI-AG', name: 'Amazing Grains Puppy Large Breed' },
  // ── ORIJEN Cat (2 products) ──
  { id: 'ORI-CK',      lineId: 'ORI-CAT', name: 'Cat & Kitten' },
  { id: 'ORI-KIT',     lineId: 'ORI-CAT', name: 'Kitten' },
  // ── ORIJEN Freeze-Dried (3 products) ──
  { id: 'ORI-FD-ORIG', lineId: 'ORI-FDL', name: 'Freeze-Dried Original' },
  { id: 'ORI-FD-TUN',  lineId: 'ORI-FDL', name: 'Freeze-Dried Tundra' },
  { id: 'ORI-FD-RR',   lineId: 'ORI-FDL', name: 'Freeze-Dried Regional Red' },
  // ── ORIJEN Treats (2 products) ──
  { id: 'ORI-EB-ORIG', lineId: 'ORI-TRT', name: 'Epic Bites Original' },
  { id: 'ORI-EB-TUN',  lineId: 'ORI-TRT', name: 'Epic Bites Tundra' },
  // ── ACANA Regionals (2 products) ──
  { id: 'ACA-WA',      lineId: 'ACA-REG', name: 'Wild Atlantic' },
  { id: 'ACA-WP',      lineId: 'ACA-REG', name: 'Wild Prairie' },
  // ── ACANA Highest Protein (2 products) ──
  { id: 'ACA-MEADOW',  lineId: 'ACA-HP', name: 'Meadowlands' },
  { id: 'ACA-HP-WA',   lineId: 'ACA-HP', name: 'Highest Protein Wild Atlantic' },
  // ── ACANA Singles (4 products) ──
  { id: 'ACA-BEEF',    lineId: 'ACA-SNG', name: 'Beef & Pumpkin' },
  { id: 'ACA-LAMB',    lineId: 'ACA-SNG', name: 'Grass-Fed Lamb' },
  { id: 'ACA-PORK',    lineId: 'ACA-SNG', name: 'Yorkshire Pork' },
  { id: 'ACA-DUCK',    lineId: 'ACA-SNG', name: 'Muscovy Duck' },
  // ── ACANA Wholesome Grains (2 products) ──
  { id: 'ACA-WG-SM',   lineId: 'ACA-WG', name: 'Wholesome Grains Small Breed' },
  { id: 'ACA-WG-LG',   lineId: 'ACA-WG', name: 'Wholesome Grains Large Breed' },
  // ── ACANA Cat (4 products) ──
  { id: 'ACA-CATCH',   lineId: 'ACA-CAT', name: 'Bountiful Catch' },
  { id: 'ACA-FF-KIT',  lineId: 'ACA-CAT', name: 'First Feast Kitten' },
  { id: 'ACA-INDOOR',  lineId: 'ACA-CAT', name: 'Indoor Entree' },
  { id: 'ACA-SR-CAT',  lineId: 'ACA-CAT', name: 'Senior Entree' },
  // ── ACANA Wet Dog (5 products) ──
  { id: 'ACA-W-BEEF',  lineId: 'ACA-WETL', name: 'Premium Chunks Beef' },
  { id: 'ACA-W-LAMB',  lineId: 'ACA-WETL', name: 'Premium Chunks Lamb' },
  { id: 'ACA-W-CHKN',  lineId: 'ACA-WETL', name: 'Premium Chunks Poultry' },
  { id: 'ACA-W-DUCK',  lineId: 'ACA-WETL', name: 'Premium Chunks Duck' },
  { id: 'ACA-W-PORK',  lineId: 'ACA-WETL', name: 'Premium Chunks Pork' },
];

// ── Size definitions by format ──
const DOG_DRY_SIZES = [
  { suffix: '4.5', size: '4.5 lb', weight: 4.5, mixPct: 0.20 },
  { suffix: '13',  size: '13 lb',  weight: 13,  mixPct: 0.35 },
  { suffix: '25',  size: '25 lb',  weight: 25,  mixPct: 0.45 },
];
const CAT_DRY_SIZES = [
  { suffix: '4',   size: '4 lb',   weight: 4,   mixPct: 0.40 },
  { suffix: '10',  size: '10 lb',  weight: 10,  mixPct: 0.60 },
];
const FD_SIZES = [
  { suffix: '6',   size: '6 oz',   weight: 0.375, mixPct: 0.55 },
  { suffix: '16',  size: '16 oz',  weight: 1,     mixPct: 0.45 },
];
const TREAT_SIZES = [
  { suffix: '3.25', size: '3.25 oz', weight: 0.2, mixPct: 0.60 },
  { suffix: '6',    size: '6 oz',    weight: 0.375, mixPct: 0.40 },
];
const WET_SIZES = [
  { suffix: '12.8', size: '12.8 oz', weight: 0.8, mixPct: 1.0 },
];

function getSizesForProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return DOG_DRY_SIZES;
  const line = lines.find(l => l.id === product.lineId);
  if (!line) return DOG_DRY_SIZES;
  const family = families.find(f => f.id === line.familyId);
  if (!family) return DOG_DRY_SIZES;
  if (family.format === 'wet') return WET_SIZES;
  if (family.format === 'freeze-dried') return FD_SIZES;
  if (family.format === 'treat') return TREAT_SIZES;
  if (family.species === 'cat') return CAT_DRY_SIZES;
  return DOG_DRY_SIZES;
}

// ── Cost/pricing data by brand and format ──
function getUnitCost(brandId, format) {
  // Cost per unit (bag/can/pouch) at wholesale
  const costs = {
    'ORIJEN-dry':           { '4.5': 18, '13': 42, '25': 72, '4': 16, '10': 38 },
    'ORIJEN-freeze-dried':  { '6': 12, '16': 28 },
    'ORIJEN-treat':         { '3.25': 6, '6': 10 },
    'ACANA-dry':            { '4.5': 14, '13': 32, '25': 56, '4': 12, '10': 28 },
    'ACANA-wet':            { '12.8': 4 },
  };
  return costs[`${brandId}-${format}`] || {};
}

// ── Generate all SKUs from products × sizes ──
export const skus = [];
for (const product of products) {
  const sizes = getSizesForProduct(product.id);
  const line = lines.find(l => l.id === product.lineId);
  const family = families.find(f => f.id === line?.familyId);
  const brandId = family?.brandId || 'ORIJEN';
  const format = family?.format || 'dry';
  const costMap = getUnitCost(brandId, format);

  for (const sz of sizes) {
    const skuId = `${product.id}-${sz.suffix}`;
    skus.push({
      id: skuId,
      productId: product.id,
      name: `${brandId === 'ORIJEN' ? 'ORIJEN' : 'ACANA'} ${product.name} ${sz.size}`,
      shortName: `${product.name} ${sz.size}`,
      size: sz.size,
      weight: sz.weight,
      sizeMixPct: sz.mixPct,
      unitCost: costMap[sz.suffix] || 20,
      uom: format === 'wet' ? 'cans' : 'bags',
      shelfLifeDays: format === 'wet' ? 730 : format === 'freeze-dried' ? 540 : 365,
      brandId,
      familyId: family?.id,
      lineId: line?.id,
      format,
      species: family?.species || 'dog',
    });
  }
}

// ── Base weekly demand per product (bags/cans per week, all sizes combined, all customers) ──
// Top sellers get 2000-4000/wk, niche items get 200-600/wk
export const baseDemandPerProduct = {
  // ORIJEN Core (premium, strong sellers)
  'ORI-ORIG':    3800, 'ORI-RRED':   2600, 'ORI-6FISH':   1800, 'ORI-TUNDRA': 1400,
  'ORI-PUPPY':   1600, 'ORI-PUP-LG': 1200, 'ORI-SM':      1100, 'ORI-SENIOR':  900,
  'ORI-FIT':      800,
  // ORIJEN Amazing Grains (growing line)
  'ORI-AG-ORIG': 2200, 'ORI-AG-6F':  1200, 'ORI-AG-RR':   1000, 'ORI-AG-SM':   700,
  'ORI-AG-FIT':   500, 'ORI-AG-PUP':  900, 'ORI-AG-PLG':   600,
  // ORIJEN Cat
  'ORI-CK':      1400, 'ORI-KIT':     600,
  // ORIJEN Freeze-Dried
  'ORI-FD-ORIG':  800, 'ORI-FD-TUN':  500, 'ORI-FD-RR':    400,
  // ORIJEN Treats
  'ORI-EB-ORIG': 1200, 'ORI-EB-TUN':  700,
  // ACANA Regionals
  'ACA-WA':      2400, 'ACA-WP':     2800,
  // ACANA Highest Protein
  'ACA-MEADOW':  1600, 'ACA-HP-WA':  1200,
  // ACANA Singles
  'ACA-BEEF':     900, 'ACA-LAMB':   1100, 'ACA-PORK':    800, 'ACA-DUCK':    600,
  // ACANA Wholesome Grains
  'ACA-WG-SM':    700, 'ACA-WG-LG':  1000,
  // ACANA Cat
  'ACA-CATCH':   1000, 'ACA-FF-KIT':  500, 'ACA-INDOOR':   800, 'ACA-SR-CAT':  400,
  // ACANA Wet Dog
  'ACA-W-BEEF':   600, 'ACA-W-LAMB':  500, 'ACA-W-CHKN':   700, 'ACA-W-DUCK':  400, 'ACA-W-PORK':  450,
};

// ── Hierarchy helpers ──

export function getProductsForLine(lineId) {
  return products.filter(p => p.lineId === lineId);
}

export function getLinesForFamily(familyId) {
  return lines.filter(l => l.familyId === familyId);
}

export function getFamiliesForBrand(brandId) {
  return families.filter(f => f.brandId === brandId);
}

export function getSkusForProduct(productId) {
  return skus.filter(s => s.productId === productId);
}

export function getSkusForLine(lineId) {
  const prods = getProductsForLine(lineId);
  return skus.filter(s => prods.some(p => p.id === s.productId));
}

export function getSkusForFamily(familyId) {
  const lns = getLinesForFamily(familyId);
  return skus.filter(s => lns.some(l => getProductsForLine(l.id).some(p => p.id === s.productId)));
}

export function getSkusForBrand(brandId) {
  const fams = getFamiliesForBrand(brandId);
  const famIds = new Set(fams.map(f => f.id));
  return skus.filter(s => famIds.has(s.familyId));
}

export function getBreadcrumb(skuId) {
  const sku = skus.find(s => s.id === skuId);
  if (!sku) return [];
  const product = products.find(p => p.id === sku.productId);
  const line = lines.find(l => l.id === product?.lineId);
  const family = families.find(f => f.id === line?.familyId);
  const brand = brands.find(b => b.id === family?.brandId);
  return [
    brand && { level: 'brand', id: brand.id, name: brand.name },
    family && { level: 'family', id: family.id, name: family.name },
    line && { level: 'line', id: line.id, name: line.name },
    product && { level: 'product', id: product.id, name: product.name },
    { level: 'sku', id: sku.id, name: sku.shortName },
  ].filter(Boolean);
}

// Full hierarchy tree for the frontend navigator
export function getHierarchyTree() {
  return brands.map(brand => ({
    ...brand,
    level: 'brand',
    children: getFamiliesForBrand(brand.id).map(family => ({
      ...family,
      level: 'family',
      children: getLinesForFamily(family.id).map(line => ({
        ...line,
        level: 'line',
        children: getProductsForLine(line.id).map(product => ({
          ...product,
          level: 'product',
          children: getSkusForProduct(product.id).map(sku => ({
            id: sku.id,
            name: sku.shortName,
            size: sku.size,
            level: 'sku',
          })),
        })),
      })),
    })),
  }));
}
