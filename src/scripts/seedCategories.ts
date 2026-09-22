import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';

const categories = [
  { name: 'Clothes', slug: 'clothes' },
  { name: 'Shoes', slug: 'shoes' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Home & Living', slug: 'home-living' },
  { name: 'Books & Stationery', slug: 'books-stationery' },
  { name: 'Beauty & Health', slug: 'beauty-health' },
];

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  for (const cat of categories) {
    const existing = await Category.findOne({ slug: cat.slug, companyId: null });
    if (existing) {
      console.log(`Already exists: ${cat.name}`);
      continue;
    }
    await Category.create({ ...cat, companyId: null });
    console.log(`Created: ${cat.name}`);
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});