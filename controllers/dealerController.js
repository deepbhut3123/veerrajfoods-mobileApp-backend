const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Dealer = require('../models/Dealer');
const DealerBill = require('../models/DealerBill');
const DealerPayment = require('../models/DealerPayment');
const User = require('../models/User');

const DEALER_ROLE_ID = 3;

const normalizeNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return NaN;
  }

  return Number(value);
};

const getValidationMessage = (error, fallback) => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  if (error.name === 'ValidationError' && error.errors && typeof error.errors === 'object') {
    const firstError = Object.values(error.errors)[0];
    if (firstError && typeof firstError.message === 'string' && firstError.message.trim()) {
      return firstError.message;
    }
    return 'Validation failed';
  }

  return fallback;
};

const buildDealerSearchValue = (dealer) =>
  [
    dealer?._id,
    dealer?.dealerName,
    dealer?.contactNo,
    dealer?.city,
    dealer?.margin,
    dealer?.pendingPayment,
    dealer?.userId?.name,
    dealer?.userId?.email,
    dealer?.userId?.mobileNumber,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();

const normalizeText = (value) => String(value || '').trim();

const generateTemporaryPassword = () =>
  crypto.randomBytes(5).toString('base64url');

const createDealerUser = async ({ dealerName, contactNo, isActive }) => {
  const normalizedContactNo = normalizeText(contactNo);
  const existingUser = await User.findOne({ mobileNumber: normalizedContactNo });

  if (existingUser) {
    if (Number(existingUser.roleId) !== DEALER_ROLE_ID) {
      const error = new Error('Mobile number is already registered with another user role');
      error.statusCode = 409;
      throw error;
    }

    existingUser.name = normalizeText(dealerName);
    existingUser.isActive = typeof isActive === 'boolean' ? isActive : true;
    await existingUser.save();
    return { user: existingUser, temporaryPassword: null };
  }

  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
  const user = await User.create({
    name: normalizeText(dealerName),
    mobileNumber: normalizedContactNo,
    password: hashedPassword,
    roleId: DEALER_ROLE_ID,
    salary: null,
    isActive: typeof isActive === 'boolean' ? isActive : true,
  });

  return { user, temporaryPassword };
};

const syncDealerUser = async ({ dealer, dealerName, contactNo, isActive }) => {
  const normalizedContactNo = normalizeText(contactNo);
  const linkedUserId = dealer?.userId;
  const duplicateUser = await User.findOne({
    mobileNumber: normalizedContactNo,
    ...(linkedUserId ? { _id: { $ne: linkedUserId } } : {}),
  });

  if (duplicateUser) {
    const error = new Error('Mobile number is already registered with another user');
    error.statusCode = 409;
    throw error;
  }

  const targetUser = linkedUserId ? await User.findById(linkedUserId) : null;
  if (!targetUser) {
    return createDealerUser({ dealerName, contactNo, isActive });
  }

  targetUser.name = normalizeText(dealerName);
  targetUser.mobileNumber = normalizedContactNo;
  targetUser.roleId = DEALER_ROLE_ID;
  targetUser.salary = null;
  if (typeof isActive === 'boolean') {
    targetUser.isActive = isActive;
  }
  await targetUser.save();

  return { user: targetUser, temporaryPassword: null };
};

const createDealer = async (req, res) => {
  try {
    const { dealerName, contactNo, city, margin, isActive } = req.body;

    if (!dealerName || !String(dealerName).trim() || !contactNo || !String(contactNo).trim() || !city || !String(city).trim()) {
      return res.status(400).json({
        success: false,
        message: 'dealerName, contactNo and city are required',
      });
    }

    const parsedMargin = normalizeNumber(margin);
    if (!Number.isFinite(parsedMargin)) {
      return res.status(400).json({
        success: false,
        message: 'margin must be a valid number',
      });
    }

    const existingDealer = await Dealer.findOne({ contactNo: String(contactNo).trim() });
    if (existingDealer) {
      return res.status(409).json({
        success: false,
        message: 'Dealer contact number is already registered',
      });
    }

    const { user: dealerUser, temporaryPassword } = await createDealerUser({
      dealerName,
      contactNo,
      isActive,
    });

    const created = await Dealer.create({
      userId: dealerUser._id,
      dealerName: String(dealerName).trim(),
      contactNo: String(contactNo).trim(),
      city: String(city).trim(),
      margin: parsedMargin,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    const populated = await Dealer.findById(created._id).populate('userId', 'name email mobileNumber roleId');

    return res.status(201).json({
      success: true,
      message: temporaryPassword
        ? 'Dealer created successfully. Temporary login password generated.'
        : 'Dealer created successfully',
      data: populated,
      temporaryPassword,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid dealer data'),
        error: error.message,
      });
    }

    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.statusCode ? error.message : 'Failed to create dealer',
      error: error.message,
    });
  }
};

const getAllDealers = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const dealerQuery = Number(req.user?.roleId) === DEALER_ROLE_ID
      ? { userId: req.user._id }
      : {};
    const dealers = await Dealer.find(dealerQuery)
      .populate('userId', 'name email mobileNumber roleId')
      .sort({ createdAt: -1 });

    const dealerIds = dealers.map((dealer) => dealer._id);
    const [billTotals, paymentTotals] = await Promise.all([
      DealerBill.aggregate([
        {
          $match: {
            dealerId: { $in: dealerIds },
          },
        },
        {
          $group: {
            _id: '$dealerId',
            totalBillAmount: { $sum: '$totalAmount' },
          },
        },
      ]),
      DealerPayment.aggregate([
        {
          $match: {
            dealerId: { $in: dealerIds },
          },
        },
        {
          $group: {
            _id: '$dealerId',
            totalPaymentAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const billTotalByDealerId = new Map(
      billTotals.map((item) => [String(item._id), Number(item.totalBillAmount || 0)]),
    );
    const paymentTotalByDealerId = new Map(
      paymentTotals.map((item) => [String(item._id), Number(item.totalPaymentAmount || 0)]),
    );

    const dealersWithPendingPayment = dealers.map((dealer) => {
      const totalBillAmount = billTotalByDealerId.get(String(dealer._id)) || 0;
      const totalPaymentAmount = paymentTotalByDealerId.get(String(dealer._id)) || 0;

      return {
        ...dealer.toObject(),
        pendingPayment: totalBillAmount - totalPaymentAmount,
      };
    });

    const filteredDealers = search
      ? dealersWithPendingPayment.filter((dealer) =>
          buildDealerSearchValue(dealer).includes(search),
        )
      : dealersWithPendingPayment;

    return res.status(200).json({
      success: true,
      message: 'Dealers fetched successfully',
      data: filteredDealers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dealers',
      error: error.message,
    });
  }
};

const updateDealer = async (req, res) => {
  try {
    const { dealerName, contactNo, city, margin, isActive } = req.body;
    const existingDealer = await Dealer.findById(req.params.id);

    if (!existingDealer) {
      return res.status(404).json({
        success: false,
        message: 'Dealer not found',
      });
    }

    if (!dealerName || !String(dealerName).trim() || !contactNo || !String(contactNo).trim() || !city || !String(city).trim()) {
      return res.status(400).json({
        success: false,
        message: 'dealerName, contactNo and city are required',
      });
    }

    const parsedMargin = normalizeNumber(margin);
    if (!Number.isFinite(parsedMargin)) {
      return res.status(400).json({
        success: false,
        message: 'margin must be a valid number',
      });
    }

    const duplicateDealer = await Dealer.findOne({
      contactNo: String(contactNo).trim(),
      _id: { $ne: existingDealer._id },
    });
    if (duplicateDealer) {
      return res.status(409).json({
        success: false,
        message: 'Dealer contact number is already registered',
      });
    }

    existingDealer.dealerName = String(dealerName).trim();
    existingDealer.contactNo = String(contactNo).trim();
    existingDealer.city = String(city).trim();
    existingDealer.margin = parsedMargin;
    if (typeof isActive === 'boolean') {
      existingDealer.isActive = isActive;
    }

    const { user: dealerUser } = await syncDealerUser({
      dealer: existingDealer,
      dealerName,
      contactNo,
      isActive: existingDealer.isActive,
    });
    existingDealer.userId = dealerUser._id;

    await existingDealer.save();
    const populated = await Dealer.findById(existingDealer._id).populate('userId', 'name email mobileNumber roleId');

    return res.status(200).json({
      success: true,
      message: 'Dealer updated successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid dealer data'),
        error: error.message,
      });
    }

    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.statusCode ? error.message : 'Failed to update dealer',
      error: error.message,
    });
  }
};

const deleteDealer = async (req, res) => {
  try {
    const deleted = await Dealer.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Dealer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Dealer deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dealer',
      error: error.message,
    });
  }
};

module.exports = {
  createDealer,
  getAllDealers,
  updateDealer,
  deleteDealer,
};
