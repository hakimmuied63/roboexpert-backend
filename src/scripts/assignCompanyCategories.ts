import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Company from '../models/Company.js';

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
    console.error('Could not find companies');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Define assignments: product slug → category slug (within the company)
  const assignments = [
    // Muied Enterprises
    { companySlug: 'muied-enterprises', productSlug: 'classic-white-t-shirt', categorySlug: 'tops' },
    { companySlug: 'muied-enterprises', productSlug: 'blue-denim-jeans', categorySlug: 'bottoms' },
    { companySlug: 'muied-enterprises', productSlug: 'black-hoodie', categorySlug: 'winter-wear' },

    // Harsha Enterprises
    { companySlug: 'harsha-enterprises', productSlug: 'white-sneakers', categorySlug: 'sneakers' },
    { companySlug: 'harsha-enterprises', productSlug: 'running-shoes-red', categorySlug: 'running' },
    { companySlug: 'harsha-enterprises', productSlug: 'leather-boots', categorySlug: 'boots' },

    // Old "Running Shoes" from Shoes Company — no company match, leave uncategorized
  ];

  for (const a of assignments) {
    const company = a.companySlug === 'muied-enterprises' ? muied : harsha;

    const product = await Product.findOne({ slug: a.productSlug, companyId: company._id });
    if (!product) {
      console.log(`Product not found: ${a.productSlug} (skipping)`);
      continue;
    }

    const category = await Category.findOne({
      slug: a.categorySlug,
      companyId: company._id,
    });
    if (!category) {
      console.log(`Category not found: ${a.categorySlug} for ${company.name} (skipping)`);
      continue;
    }

    await Product.updateOne({ _id: product._id }, { $set: { categoryId: category._id } });
    console.log(`Assigned ${product.name} → ${category.name} (${company.name})`);
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});