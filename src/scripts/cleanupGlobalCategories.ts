import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Find old global categories
  const globalCategories = await Category.find({ companyId: null });
  console.log(`Found ${globalCategories.length} global categories`);

  if (globalCategories.length === 0) {
    console.log('Nothing to clean up');
    await mongoose.disconnect();
    process.exit(0);
  }

  const globalIds = globalCategories.map((c) => c._id);

  // Clear categoryId on products that reference these categories
  const updateResult = await Product.updateMany(
    { categoryId: { $in: globalIds } },
    { $set: { categoryId: null } }
  );
  console.log(`Cleared categoryId on ${updateResult.modifiedCount} products`);

  // Delete the global categories
  const deleteResult = await Category.deleteMany({ companyId: null });
  console.log(`Deleted ${deleteResult.deletedCount} global categories`);

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});