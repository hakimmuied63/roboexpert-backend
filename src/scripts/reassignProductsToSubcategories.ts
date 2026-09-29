import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const MUied_ID = '6ab20fcbd9da2f2c8ee6035d';
const HARSHA_ID = '6ab20ffed9da2f2c8ee60366';

// productSlug → target subcategory slug (within the same company)
const ASSIGNMENTS: Array<{
  companyId: string;
  productSlug: string;
  subcategorySlug: string;
}> = [
  // Muied products
  { companyId: MUied_ID, productSlug: 'navy-blue-polo-tshirt', subcategorySlug: 'polos' },
  { companyId: MUied_ID, productSlug: 'classic-white-t-shirt', subcategorySlug: 't-shirts' },
  { companyId: MUied_ID, productSlug: 'striped-casual-shirt', subcategorySlug: 'shirts' },
  { companyId: MUied_ID, productSlug: 'blue-denim-jeans', subcategorySlug: 'jeans' },
  { companyId: MUied_ID, productSlug: 'slim-fit-chinos', subcategorySlug: 'chinos' },
  { companyId: MUied_ID, productSlug: 'casual-denim-shorts', subcategorySlug: 'shorts' },
  { companyId: MUied_ID, productSlug: 'wool-blend-sweater', subcategorySlug: 'sweaters' },
  { companyId: MUied_ID, productSlug: 'puffer-jacket', subcategorySlug: 'jackets' },
  { companyId: MUied_ID, productSlug: 'cotton-kurta', subcategorySlug: 'kurtas' },
  { companyId: MUied_ID, productSlug: 'silk-saree', subcategorySlug: 'sarees' },
  { companyId: MUied_ID, productSlug: 'track-pants', subcategorySlug: 'track-pants' },
  { companyId: MUied_ID, productSlug: 'sports-training-tee', subcategorySlug: 'sports-tees' },
  { companyId: MUied_ID, productSlug: 'leather-belt', subcategorySlug: 'belts' },
  { companyId: MUied_ID, productSlug: 'baseball-cap', subcategorySlug: 'caps' },

  // Harsha products
  { companyId: HARSHA_ID, productSlug: 'white-sneakers', subcategorySlug: 'casual-sneakers' },
  { companyId: HARSHA_ID, productSlug: 'black-running-sneakers', subcategorySlug: 'running-sneakers' },
  { companyId: HARSHA_ID, productSlug: 'casual-canvas-sneakers', subcategorySlug: 'casual-sneakers' },
  { companyId: HARSHA_ID, productSlug: 'running-shoes-red', subcategorySlug: 'road-running' },
  { companyId: HARSHA_ID, productSlug: 'blue-running-shoes', subcategorySlug: 'road-running' },
  { companyId: HARSHA_ID, productSlug: 'trail-running-shoes', subcategorySlug: 'trail-running' },
  { companyId: HARSHA_ID, productSlug: 'brown-oxford-shoes', subcategorySlug: 'oxfords' },
  { companyId: HARSHA_ID, productSlug: 'black-leather-loafers', subcategorySlug: 'loafers' },
  { companyId: HARSHA_ID, productSlug: 'leather-boots', subcategorySlug: 'leather-boots' },
  { companyId: HARSHA_ID, productSlug: 'ankle-boots', subcategorySlug: 'ankle-boots' },
  { companyId: HARSHA_ID, productSlug: 'casual-flip-flops', subcategorySlug: 'flip-flops' },
  { companyId: HARSHA_ID, productSlug: 'football-cleats', subcategorySlug: 'football' },
  { companyId: HARSHA_ID, productSlug: 'cricket-spikes', subcategorySlug: 'cricket' },
];

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  let updated = 0;
  let skipped = 0;

  for (const a of ASSIGNMENTS) {
    const product = await Product.findOne({
      companyId: a.companyId,
      slug: a.productSlug,
    });

    if (!product) {
      console.log(`  ⚠️  Product not found: ${a.productSlug}`);
      skipped++;
      continue;
    }

    const subcategory = await Category.findOne({
      companyId: a.companyId,
      slug: a.subcategorySlug,
    });

    if (!subcategory) {
      console.log(
        `  ⚠️  Subcategory not found: ${a.subcategorySlug} (product: ${product.name})`
      );
      skipped++;
      continue;
    }

    await Product.updateOne(
      { _id: product._id },
      { $set: { categoryId: subcategory._id } }
    );

    console.log(`  ✓ ${product.name} → ${subcategory.name}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});