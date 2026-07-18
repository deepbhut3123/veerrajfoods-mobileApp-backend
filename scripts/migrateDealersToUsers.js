const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const Dealer = require('../models/Dealer');
const User = require('../models/User');

const DEALER_ROLE_ID = 3;

const normalizeText = (value) => String(value || '').trim();

const generateTemporaryPassword = () =>
  crypto.randomBytes(9).toString('base64url');

const ensureOptionalUniqueIndexes = async () => {
  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find((index) => index.name === 'email_1');

  if (emailIndex?.unique && !emailIndex.sparse && !emailIndex.partialFilterExpression) {
    await User.collection.dropIndex('email_1');
  }

  await User.createIndexes();
};

const migrateDealersToUsers = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(process.env.MONGO_URI);
  await ensureOptionalUniqueIndexes();

  const dealers = await Dealer.find({}).sort({ createdAt: 1 });
  const migrated = [];
  const skipped = [];

  for (const dealer of dealers) {
    const dealerName = normalizeText(dealer.dealerName);
    const mobileNumber = normalizeText(dealer.contactNo);

    if (!dealerName || !mobileNumber) {
      skipped.push({
        dealerId: String(dealer._id),
        dealerName,
        mobileNumber,
        reason: 'Missing dealer name or contact number',
      });
      continue;
    }

    const userByMobile = await User.findOne({ mobileNumber });
    const linkedUser = dealer.userId ? await User.findById(dealer.userId) : null;
    const targetUser = userByMobile || linkedUser;
    let temporaryPassword = '';

    if (targetUser) {
      if (Number(targetUser.roleId) !== DEALER_ROLE_ID) {
        skipped.push({
          dealerId: String(dealer._id),
          dealerName,
          mobileNumber,
          userId: String(targetUser._id),
          reason: `Mobile/link user already exists with role ${targetUser.roleId}`,
        });
        continue;
      }

      targetUser.name = dealerName;
      targetUser.mobileNumber = mobileNumber;
      targetUser.salary = null;
      targetUser.isActive = dealer.isActive !== false;
      await targetUser.save();

      dealer.userId = targetUser._id;
      await dealer.save();

      migrated.push({
        dealerId: String(dealer._id),
        dealerName,
        mobileNumber,
        userId: String(targetUser._id),
        temporaryPassword,
        status: 'linked existing dealer user',
      });
      continue;
    }

    temporaryPassword = generateTemporaryPassword();
    const password = await bcrypt.hash(temporaryPassword, 10);
    const user = await User.create({
      name: dealerName,
      mobileNumber,
      password,
      roleId: DEALER_ROLE_ID,
      salary: null,
      isActive: dealer.isActive !== false,
    });

    dealer.userId = user._id;
    await dealer.save();

    migrated.push({
      dealerId: String(dealer._id),
      dealerName,
      mobileNumber,
      userId: String(user._id),
      temporaryPassword,
      status: 'created dealer user',
    });
  }

  return {
    totalDealers: dealers.length,
    migratedCount: migrated.length,
    skippedCount: skipped.length,
    migrated,
    skipped,
  };
};

migrateDealersToUsers()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
