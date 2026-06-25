const Dealer = require('../models/Dealer');
const DealerPayment = require('../models/DealerPayment');

const PAYMENT_TYPES = new Set(['cash', 'online', 'bank']);

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

const buildDealerPaymentSearchValue = (payment) =>
  [
    payment?._id,
    payment?.paymentDate,
    payment?.amount,
    payment?.paymentType,
    payment?.dealerId?._id,
    payment?.dealerId?.dealerName,
    payment?.dealerId?.contactNo,
    payment?.dealerId?.city,
    payment?.userId?._id,
    payment?.userId?.name,
    payment?.userId?.email,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();

const populateDealerPayment = (query) =>
  query
    .populate('userId', 'name email roleId')
    .populate('dealerId', 'dealerName contactNo city margin isActive');

const buildDealerPaymentPayload = async ({ dealerId, paymentDate, amount, paymentType }) => {
  if (!dealerId || !paymentDate || amount === undefined || amount === null || paymentType === undefined || paymentType === null) {
    return {
      error: {
        status: 400,
        message: 'dealerId, paymentDate, amount and paymentType are required',
      },
    };
  }

  const dealer = await Dealer.findById(dealerId);
  if (!dealer) {
    return {
      error: {
        status: 404,
        message: 'Dealer not found',
      },
    };
  }

  const normalizedPaymentDate = new Date(paymentDate);
  if (Number.isNaN(normalizedPaymentDate.getTime())) {
    return {
      error: {
        status: 400,
        message: 'paymentDate must be a valid date',
      },
    };
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return {
      error: {
        status: 400,
        message: 'amount must be greater than 0',
      },
    };
  }

  const normalizedPaymentType = String(paymentType).trim().toLowerCase();
  if (!PAYMENT_TYPES.has(normalizedPaymentType)) {
    return {
      error: {
        status: 400,
        message: 'paymentType must be cash, online or bank',
      },
    };
  }

  return {
    payload: {
      dealerId: dealer._id,
      paymentDate: normalizedPaymentDate,
      amount: normalizedAmount,
      paymentType: normalizedPaymentType,
    },
  };
};

const createDealerPayment = async (req, res) => {
  try {
    const { dealerId, paymentDate, amount, paymentType } = req.body;
    const prepared = await buildDealerPaymentPayload({
      dealerId,
      paymentDate,
      amount,
      paymentType,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const created = await DealerPayment.create({
      userId: req.user._id,
      ...prepared.payload,
    });

    const populated = await populateDealerPayment(DealerPayment.findById(created._id));

    return res.status(201).json({
      success: true,
      message: 'Dealer payment created successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid dealer payment data'),
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create dealer payment',
      error: error.message,
    });
  }
};

const getAllDealerPayments = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const dealerId = String(req.query?.dealerId || '').trim();
    const fromDate = String(req.query?.fromDate || '').trim();
    const toDate = String(req.query?.toDate || '').trim();
    const query = {};

    if (dealerId) {
      query.dealerId = dealerId;
    }

    if (fromDate || toDate) {
      query.paymentDate = {};

      if (fromDate) {
        const parsedFromDate = new Date(fromDate);
        if (Number.isNaN(parsedFromDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'fromDate must be a valid date',
          });
        }

        parsedFromDate.setHours(0, 0, 0, 0);
        query.paymentDate.$gte = parsedFromDate;
      }

      if (toDate) {
        const parsedToDate = new Date(toDate);
        if (Number.isNaN(parsedToDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'toDate must be a valid date',
          });
        }

        parsedToDate.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = parsedToDate;
      }
    }

    const payments = await populateDealerPayment(
      DealerPayment.find(query).sort({ paymentDate: -1, createdAt: -1 }),
    );

    const filteredPayments = search
      ? payments.filter((payment) => buildDealerPaymentSearchValue(payment).includes(search))
      : payments;

    return res.status(200).json({
      success: true,
      message: 'Dealer payments fetched successfully',
      data: filteredPayments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dealer payments',
      error: error.message,
    });
  }
};

const updateDealerPayment = async (req, res) => {
  try {
    const existingPayment = await DealerPayment.findById(req.params.id);
    if (!existingPayment) {
      return res.status(404).json({
        success: false,
        message: 'Dealer payment not found',
      });
    }

    const { dealerId, paymentDate, amount, paymentType } = req.body;
    const prepared = await buildDealerPaymentPayload({
      dealerId,
      paymentDate,
      amount,
      paymentType,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    existingPayment.dealerId = prepared.payload.dealerId;
    existingPayment.paymentDate = prepared.payload.paymentDate;
    existingPayment.amount = prepared.payload.amount;
    existingPayment.paymentType = prepared.payload.paymentType;
    await existingPayment.save();

    const populated = await populateDealerPayment(DealerPayment.findById(existingPayment._id));

    return res.status(200).json({
      success: true,
      message: 'Dealer payment updated successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid dealer payment data'),
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update dealer payment',
      error: error.message,
    });
  }
};

const deleteDealerPayment = async (req, res) => {
  try {
    const deleted = await DealerPayment.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Dealer payment not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Dealer payment deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dealer payment',
      error: error.message,
    });
  }
};

module.exports = {
  createDealerPayment,
  getAllDealerPayments,
  updateDealerPayment,
  deleteDealerPayment,
};
