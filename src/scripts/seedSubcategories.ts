import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';

const MUied_ID = '6ab20fcbd9da2f2c8ee6035d';
const HARSHA_ID = '6ab20ffed9da2f2c8ee60366';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Parent name → list of children names
const MUIED_TREE: Record<string, string[]> = {
  tops: ['T-Shirts', 'Shirts', 'Polos'],
  bottoms: ['Jeans', 'Chinos', 'Shorts'],
  'winter-wear': ['Sweaters', 'Jackets'],
  'ethnic-wear': ['Kurtas', 'Sarees'],
  sportswear: ['Track Pants', 'Sports Tees'],
  accessories: ['Belts', 'Caps'],
};

const HARSHA_TREE: Record<string, string[]> = {
  sneakers: ['Casual Sneakers', 'Running Sneakers'],
  running: ['Trail Running', 'Road Running'],
  formal: ['Oxfords', 'Loafers'],
  boots: ['Ankle Boots', 'Leather Boots'],
  sandals: ['Flip Flops', 'Slides'],
  sports: ['Football', 'Cricket'],
};

const seedForCompany = async (
  companyId: string,
  tree: Record<string, string[]>
) => {
  console.log(`\n--- Seeding for company ${companyId} ---`);

  for (const [parentSlug, childNames] of Object.entries(tree)) {
    const parent = await Category.findOne({ companyId, slug: parentSlug });
    if (!parent) {
      console.log(`  ⚠️  Parent not found: ${parentSlug}`);
      continue;
    }

    console.log(`\nParent: ${parent.name} (${parentSlug})`);

    for (const childName of childNames) {
      const childSlug = slugify(childName);

      const existing = await Category.findOne({
        companyId,
        slug: childSlug,
      });
      if (existing) {
        console.log(`  Skipped (exists): ${childName}`);
        continue;
      }

      await Category.create({
        name: childName,
        slug: childSlug,
        companyId,
        parentId: parent._id,
        isActive: true,
      });

      console.log(`  Created: ${childName}`);
    }
  }
};

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  await seedForCompany(MUied_ID, MUIED_TREE);
  await seedForCompany(HARSHA_ID, HARSHA_TREE);

  await mongoose.disconnect();
  console.log('\nDone');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});