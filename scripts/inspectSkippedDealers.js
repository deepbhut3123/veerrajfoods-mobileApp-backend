const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const Dealer = require('../models/Dealer');
const User = require('../models/User');

const dealerIds = [
  '6a4cdf1e84d2561d4491e65c',
  '6a59deaed44a3ed8d4a941d7',
];

const inspectSkippedDealers = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const dealers = await Dealer.find({ _id: { $in: dealerIds } }).lean();
  const userIds = [...new Set(dealers.map((dealer) => String(dealer.userId)).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).lean();

  console.log(JSON.stringify({
    dealers,
    users: users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      roleId: user.roleId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
  }, null, 2));
};

inspectSkippedDealers()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
