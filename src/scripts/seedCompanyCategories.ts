import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Company from '../models/Company.js';

const MUied_CATEGORIES = [
  { name: 'Tops', slug: 'tops' },
  { name: 'Bottoms', slug: 'bottoms' },
  { name: 'Winter Wear', slug: 'winter-wear' },
  { name: 'Ethnic Wear', slug: 'ethnic-wear' },
  { name: 'Sportswear', slug: 'sportswear' },
  { name: 'Accessories', slug: 'accessories' },
];

const HARSHA_CATEGORIES = [
  { name: 'Sneakers', slug: 'sneakers' },
  { name: 'Running', slug: 'running' },
  { name: 'Formal', slug: 'formal' },
  { name: 'Boots', slug: 'boots' },
  { name: 'Sandals', slug: 'sandals' },
  { name: 'Sports', slug: 'sports' },
];

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const muied = await Company.findOne({ slug: 'muied-enterprises' });
  const harsha = await Company.findOne({ slug: 'harsha-enterprises' });

  if (!muied || !harsha) {
    console.error('Could not find Muied or Harsha company');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Muied company ID: ${muied._id}`);
  console.log(`Harsha company ID: ${harsha._id}`);

  // Seed Muied
  for (const cat of MUied_CATEGORIES) {
    const existing = await Category.findOne({ companyId: muied._id, slug: cat.slug });
    if (existing) {
      console.log(`Already exists (Muied): ${cat.name}`);
      continue;
    }
    await Category.create({ ...cat, companyId: muied._id });
    console.log(`Created (Muied): ${cat.name}`);
  }

  // Seed Harsha
  for (const cat of HARSHA_CATEGORIES) {
    const existing = await Category.findOne({ companyId: harsha._id, slug: cat.slug });
    if (existing) {
      console.log(`Already exists (Harsha): ${cat.name}`);
      continue;
    }
    await Category.create({ ...cat, companyId: harsha._id });
    console.log(`Created (Harsha): ${cat.name}`);
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});