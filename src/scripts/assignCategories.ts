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

  const clothes = await Category.findOne({ slug: 'clothes', companyId: null });
  const shoes = await Category.findOne({ slug: 'shoes', companyId: null });

  if (!clothes || !shoes) {
    console.error('Categories "clothes" or "shoes" not found. Run seedCategories first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Assign categories by product name
  const clothesProducts = ['classic-white-t-shirt', 'blue-denim-jeans', 'black-hoodie'];
  const shoesProducts = ['white-sneakers', 'running-shoes-red', 'leather-boots'];

  // Also match the old "Running Shoes" product
  const allClothes = [...clothesProducts];
  const allShoes = [...shoesProducts, 'running-shoes'];

  const clothesResult = await Product.updateMany(
    { slug: { $in: allClothes } },
    { $set: { categoryId: clothes._id } }
  );
  console.log(`Updated ${clothesResult.modifiedCount} products to "Clothes"`);

  const shoesResult = await Product.updateMany(
    { slug: { $in: allShoes } },
    { $set: { categoryId: shoes._id } }
  );
  console.log(`Updated ${shoesResult.modifiedCount} products to "Shoes"`);

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});