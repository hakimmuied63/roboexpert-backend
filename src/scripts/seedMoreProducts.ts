import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ProductVariant from '../models/ProductVariant.js';

const MUied_ID = '6ab20fcbd9da2f2c8ee6035d';
const HARSHA_ID = '6ab20ffed9da2f2c8ee60366';

// Muied category IDs
const MU_CAT = {
  tops: '6ab6066b37bc8e69f36c6be7',
  bottoms: '6ab36efdba5b7af22b5033d2',
  winter: '6ab36efdba5b7af22b5033d5',
  ethnic: '6ab36efdba5b7af22b5033d8',
  sports: '6ab36efdba5b7af22b5033db',
  accessories: '6ab36efdba5b7af22b5033de',
};

// Harsha category IDs
const HA_CAT = {
  sneakers: '6ab36efdba5b7af22b5033e1',
  running: '6ab36efeba5b7af22b5033e4',
  formal: '6ab36efeba5b7af22b5033e7',
  boots: '6ab36efeba5b7af22b5033ea',
  sandals: '6ab36efeba5b7af22b5033ed',
  sports: '6ab36efeba5b7af22b5033f0',
};

type VariantInput = {
  sku: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
};

type ProductInput = {
  companyId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  image: string;
  variants: VariantInput[];
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const products: ProductInput[] = [
  // =================== MUIED ENTERPRISES (CLOTHES) ===================

  // Tops
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.tops,
    name: 'Navy Blue Polo T-Shirt',
    slug: 'navy-blue-polo-tshirt',
    description: 'Classic navy blue polo t-shirt in soft cotton pique fabric.',
    basePrice: 599,
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600',
    variants: [
      { sku: 'POLO-NAVY-S', size: 'S', color: 'Navy', price: 599, stock: 30 },
      { sku: 'POLO-NAVY-M', size: 'M', color: 'Navy', price: 599, stock: 40 },
      { sku: 'POLO-NAVY-L', size: 'L', color: 'Navy', price: 599, stock: 25 },
    ],
  },
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.tops,
    name: 'Striped Casual Shirt',
    slug: 'striped-casual-shirt',
    description: 'Light blue striped casual shirt, perfect for weekend wear.',
    basePrice: 899,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600',
    variants: [
      { sku: 'SHIRT-STRIPE-M', size: 'M', color: 'Blue', price: 899, stock: 20 },
      { sku: 'SHIRT-STRIPE-L', size: 'L', color: 'Blue', price: 899, stock: 25 },
      { sku: 'SHIRT-STRIPE-XL', size: 'XL', color: 'Blue', price: 899, stock: 15 },
    ],
  },

  // Bottom wear
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.bottoms,
    name: 'Slim Fit Chinos',
    slug: 'slim-fit-chinos',
    description: 'Beige slim fit chinos for a smart casual look.',
    basePrice: 1299,
    image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600',
    variants: [
      { sku: 'CHINO-BEIGE-30', size: '30', color: 'Beige', price: 1299, stock: 15 },
      { sku: 'CHINO-BEIGE-32', size: '32', color: 'Beige', price: 1299, stock: 20 },
      { sku: 'CHINO-BEIGE-34', size: '34', color: 'Beige', price: 1299, stock: 12 },
    ],
  },
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.bottoms,
    name: 'Casual Denim Shorts',
    slug: 'casual-denim-shorts',
    description: 'Relaxed-fit denim shorts for summer days.',
    basePrice: 799,
    image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600',
    variants: [
      { sku: 'SHORTS-DENIM-30', size: '30', color: 'Blue', price: 799, stock: 18 },
      { sku: 'SHORTS-DENIM-32', size: '32', color: 'Blue', price: 799, stock: 22 },
    ],
  },

  // Winter Wear
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.winter,
    name: 'Wool Blend Sweater',
    slug: 'wool-blend-sweater',
    description: 'Cozy wool blend sweater for cold days.',
    basePrice: 1499,
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600',
    variants: [
      { sku: 'SWEATER-WOOL-M', size: 'M', color: 'Grey', price: 1499, stock: 15 },
      { sku: 'SWEATER-WOOL-L', size: 'L', color: 'Grey', price: 1499, stock: 18 },
    ],
  },
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.winter,
    name: 'Puffer Jacket',
    slug: 'puffer-jacket',
    description: 'Black puffer jacket — lightweight, warm, water-resistant.',
    basePrice: 2999,
    image: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600',
    variants: [
      { sku: 'JACKET-PUFFER-M', size: 'M', color: 'Black', price: 2999, stock: 10 },
      { sku: 'JACKET-PUFFER-L', size: 'L', color: 'Black', price: 2999, stock: 12 },
      { sku: 'JACKET-PUFFER-XL', size: 'XL', color: 'Black', price: 2999, stock: 8 },
    ],
  },

  // Ethnic Wear
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.ethnic,
    name: 'Cotton Kurta',
    slug: 'cotton-kurta',
    description: 'Traditional cotton kurta in off-white.',
    basePrice: 999,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600',
    variants: [
      { sku: 'KURTA-COT-M', size: 'M', color: 'White', price: 999, stock: 20 },
      { sku: 'KURTA-COT-L', size: 'L', color: 'White', price: 999, stock: 25 },
    ],
  },
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.ethnic,
    name: 'Silk Saree',
    slug: 'silk-saree',
    description: 'Elegant silk saree with zari border.',
    basePrice: 3499,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600',
    variants: [
      { sku: 'SAREE-SILK-1', size: 'Free', color: 'Red', price: 3499, stock: 6 },
    ],
  },

  // Sportswear
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.sports,
    name: 'Track Pants',
    slug: 'track-pants',
    description: 'Black track pants with side stripes.',
    basePrice: 699,
    image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600',
    variants: [
      { sku: 'TRACK-BLK-M', size: 'M', color: 'Black', price: 699, stock: 30 },
      { sku: 'TRACK-BLK-L', size: 'L', color: 'Black', price: 699, stock: 28 },
      { sku: 'TRACK-BLK-XL', size: 'XL', color: 'Black', price: 699, stock: 15 },
    ],
  },
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.sports,
    name: 'Sports Training Tee',
    slug: 'sports-training-tee',
    description: 'Moisture-wicking training t-shirt.',
    basePrice: 499,
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600',
    variants: [
      { sku: 'SPORT-TEE-M', size: 'M', color: 'Black', price: 499, stock: 35 },
      { sku: 'SPORT-TEE-L', size: 'L', color: 'Black', price: 499, stock: 30 },
    ],
  },

  // Accessories
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.accessories,
    name: 'Leather Belt',
    slug: 'leather-belt',
    description: 'Genuine leather belt with brass buckle.',
    basePrice: 499,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600',
    variants: [
      { sku: 'BELT-BRN-32', size: '32', color: 'Brown', price: 499, stock: 25 },
      { sku: 'BELT-BRN-34', size: '34', color: 'Brown', price: 499, stock: 30 },
      { sku: 'BELT-BRN-36', size: '36', color: 'Brown', price: 499, stock: 20 },
    ],
  },
  {
    companyId: MUied_ID,
    categoryId: MU_CAT.accessories,
    name: 'Baseball Cap',
    slug: 'baseball-cap',
    description: 'Adjustable cotton baseball cap.',
    basePrice: 299,
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600',
    variants: [
      { sku: 'CAP-BLK-1', size: 'Free', color: 'Black', price: 299, stock: 40 },
    ],
  },

  // =================== HARSHA ENTERPRISES (SHOES) ===================

  // Sneakers
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.sneakers,
    name: 'Black Running Sneakers',
    slug: 'black-running-sneakers',
    description: 'Lightweight black sneakers with cushioned soles.',
    basePrice: 2499,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
    variants: [
      { sku: 'SNKR-BLK-8', size: '8', color: 'Black', price: 2499, stock: 15 },
      { sku: 'SNKR-BLK-9', size: '9', color: 'Black', price: 2499, stock: 20 },
      { sku: 'SNKR-BLK-10', size: '10', color: 'Black', price: 2499, stock: 15 },
    ],
  },
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.sneakers,
    name: 'Casual Canvas Sneakers',
    slug: 'casual-canvas-sneakers',
    description: 'Classic canvas sneakers for everyday wear.',
    basePrice: 1299,
    image: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600',
    variants: [
      { sku: 'CANVAS-WHT-8', size: '8', color: 'White', price: 1299, stock: 25 },
      { sku: 'CANVAS-WHT-9', size: '9', color: 'White', price: 1299, stock: 30 },
    ],
  },

  // Running
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.running,
    name: 'Blue Running Shoes',
    slug: 'blue-running-shoes',
    description: 'Blue running shoes with breathable mesh upper.',
    basePrice: 2199,
    image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600',
    variants: [
      { sku: 'RUN-BLU-8', size: '8', color: 'Blue', price: 2199, stock: 20 },
      { sku: 'RUN-BLU-9', size: '9', color: 'Blue', price: 2199, stock: 25 },
      { sku: 'RUN-BLU-10', size: '10', color: 'Blue', price: 2199, stock: 18 },
    ],
  },
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.running,
    name: 'Trail Running Shoes',
    slug: 'trail-running-shoes',
    description: 'Rugged trail running shoes with grip sole.',
    basePrice: 3199,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600',
    variants: [
      { sku: 'TRAIL-ORG-9', size: '9', color: 'Orange', price: 3199, stock: 12 },
      { sku: 'TRAIL-ORG-10', size: '10', color: 'Orange', price: 3199, stock: 14 },
    ],
  },

  // Formal
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.formal,
    name: 'Brown Oxford Shoes',
    slug: 'brown-oxford-shoes',
    description: 'Classic brown leather oxford shoes for formal occasions.',
    basePrice: 3499,
    image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=600',
    variants: [
      { sku: 'OXFORD-BRN-8', size: '8', color: 'Brown', price: 3499, stock: 10 },
      { sku: 'OXFORD-BRN-9', size: '9', color: 'Brown', price: 3499, stock: 12 },
      { sku: 'OXFORD-BRN-10', size: '10', color: 'Brown', price: 3499, stock: 8 },
    ],
  },
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.formal,
    name: 'Black Leather Loafers',
    slug: 'black-leather-loafers',
    description: 'Slip-on black leather loafers for office wear.',
    basePrice: 2799,
    image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600',
    variants: [
      { sku: 'LOAFER-BLK-8', size: '8', color: 'Black', price: 2799, stock: 15 },
      { sku: 'LOAFER-BLK-9', size: '9', color: 'Black', price: 2799, stock: 18 },
    ],
  },

  // Boots
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.boots,
    name: 'Ankle Boots',
    slug: 'ankle-boots',
    description: 'Stylish brown ankle boots for the outdoors.',
    basePrice: 3899,
    image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600',
    variants: [
      { sku: 'ANKLE-BRN-9', size: '9', color: 'Brown', price: 3899, stock: 8 },
      { sku: 'ANKLE-BRN-10', size: '10', color: 'Brown', price: 3899, stock: 10 },
    ],
  },

  // Sandals
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.sandals,
    name: 'Casual Flip Flops',
    slug: 'casual-flip-flops',
    description: 'Comfortable everyday flip flops.',
    basePrice: 399,
    image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600',
    variants: [
      { sku: 'FLIP-BLK-7', size: '7', color: 'Black', price: 399, stock: 40 },
      { sku: 'FLIP-BLK-8', size: '8', color: 'Black', price: 399, stock: 45 },
      { sku: 'FLIP-BLK-9', size: '9', color: 'Black', price: 399, stock: 35 },
    ],
  },

  // Sports
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.sports,
    name: 'Football Cleats',
    slug: 'football-cleats',
    description: 'Professional-grade football cleats with studded sole.',
    basePrice: 2999,
    image: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600',
    variants: [
      { sku: 'CLEATS-8', size: '8', color: 'Green', price: 2999, stock: 12 },
      { sku: 'CLEATS-9', size: '9', color: 'Green', price: 2999, stock: 15 },
    ],
  },
  {
    companyId: HARSHA_ID,
    categoryId: HA_CAT.sports,
    name: 'Cricket Spikes',
    slug: 'cricket-spikes',
    description: 'White cricket spikes for professional play.',
    basePrice: 3299,
    image: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600',
    variants: [
      { sku: 'SPIKE-WHT-9', size: '9', color: 'White', price: 3299, stock: 10 },
      { sku: 'SPIKE-WHT-10', size: '10', color: 'White', price: 3299, stock: 12 },
    ],
  },
];

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    // Skip if product with this slug already exists for this company
    const existing = await Product.findOne({ companyId: p.companyId, slug: p.slug });
    if (existing) {
      console.log(`Skipped (exists): ${p.name}`);
      skipped++;
      continue;
    }

    const product = await Product.create({
      companyId: p.companyId,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      basePrice: p.basePrice,
      images: [p.image],
      isActive: true,
    });

    await ProductVariant.insertMany(
      p.variants.map((v) => ({
        productId: product._id,
        companyId: p.companyId,
        sku: v.sku,
        attributes: {
          ...(v.size ? { size: v.size } : {}),
          ...(v.color ? { color: v.color } : {}),
        },
        price: v.price,
        stock: v.stock,
        isActive: true,
      }))
    );

    console.log(`Created: ${p.name} (${p.variants.length} variants)`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Total: ${products.length}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});