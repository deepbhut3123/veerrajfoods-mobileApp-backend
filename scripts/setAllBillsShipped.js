require('dotenv').config();
const mongoose = require('mongoose');
const Bill = require('../models/Bill');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URL;

const run = async () => {
  if (!mongoUri) {
    throw new Error('Mongo connection string missing. Set MONGO_URI, MONGODB_URI, or DB_URL.');
  }

  await mongoose.connect(mongoUri);

  const now = new Date();
  const result = await Bill.updateMany(
    {},
    {
      $set: {
        status: 'shipped',
        stockDeductedAt: now,
      },
    },
  );

  console.log(`Bills matched: ${result.matchedCount}`);
  console.log(`Bills updated: ${result.modifiedCount}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
