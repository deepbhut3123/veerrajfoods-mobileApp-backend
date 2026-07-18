const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const Dealer = require('../models/Dealer');
const User = require('../models/User');

const DEALER_ROLE_ID = 3;
const skippedDealerIds = [
  '6a4cdf1e84d2561d4491e65c',
  '6a59deaed44a3ed8d4a941d7',
];

const normalizeText = (value) => String(value || '').trim();
const generateTemporaryPassword = () => crypto.randomBytes(9).toString('base64url');

const fixSkippedDealerUsers = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const dealers = await Dealer.find({ _id: { $in: skippedDealerIds } }).sort({ createdAt: 1 });
  const fixed = [];
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
    if (userByMobile && Number(userByMobile.roleId) !== DEALER_ROLE_ID) {
      skipped.push({
        dealerId: String(dealer._id),
        dealerName,
        mobileNumber,
        userId: String(userByMobile._id),
        reason: `Mobile number already exists with role ${userByMobile.roleId}`,
      });
      continue;
    }

    if (userByMobile) {
      userByMobile.name = dealerName;
      userByMobile.roleId = DEALER_ROLE_ID;
      userByMobile.salary = null;
      userByMobile.isActive = dealer.isActive !== false;
      await userByMobile.save();

      dealer.userId = userByMobile._id;
      await dealer.save();

      fixed.push({
        dealerId: String(dealer._id),
        dealerName,
        mobileNumber,
        userId: String(userByMobile._id),
        temporaryPassword: '',
        status: 'linked existing dealer user',
      });
      continue;
    }

    const temporaryPassword = generateTemporaryPassword();
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

    fixed.push({
      dealerId: String(dealer._id),
      dealerName,
      mobileNumber,
      userId: String(user._id),
      temporaryPassword,
      status: 'created separate dealer user',
    });
  }

  return {
    requestedCount: skippedDealerIds.length,
    fixedCount: fixed.length,
    skippedCount: skipped.length,
    fixed,
    skipped,
  };
};

fixSkippedDealerUsers()
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
