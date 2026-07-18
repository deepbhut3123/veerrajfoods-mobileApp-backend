const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const Dealer = require('../models/Dealer');
const User = require('../models/User');

const DEALER_ROLE_ID = 3;

const normalizePasswordName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const setDealerNamePasswords = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const dealers = await Dealer.find({}).populate('userId', 'name mobileNumber roleId').sort({ dealerName: 1 });
  const updated = [];
  const skipped = [];

  for (const dealer of dealers) {
    const user = dealer.userId;
    const passwordName = normalizePasswordName(dealer.dealerName);

    if (!user) {
      skipped.push({
        dealerName: dealer.dealerName,
        mobileNumber: dealer.contactNo,
        reason: 'Dealer has no linked user',
      });
      continue;
    }

    if (Number(user.roleId) !== DEALER_ROLE_ID) {
      skipped.push({
        dealerName: dealer.dealerName,
        mobileNumber: dealer.contactNo,
        userId: String(user._id),
        roleId: user.roleId,
        reason: 'Linked user is not dealer role',
      });
      continue;
    }

    if (!passwordName) {
      skipped.push({
        dealerName: dealer.dealerName,
        mobileNumber: dealer.contactNo,
        userId: String(user._id),
        reason: 'Dealer name cannot generate password',
      });
      continue;
    }

    const password = `${passwordName}@123`;
    await User.findByIdAndUpdate(user._id, {
      password: await bcrypt.hash(password, 10),
    });

    updated.push({
      dealerName: dealer.dealerName,
      mobileNumber: dealer.contactNo,
      userId: String(user._id),
      password,
    });
  }

  return {
    totalDealers: dealers.length,
    updatedCount: updated.length,
    skippedCount: skipped.length,
    updated,
    skipped,
  };
};

setDealerNamePasswords()
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
