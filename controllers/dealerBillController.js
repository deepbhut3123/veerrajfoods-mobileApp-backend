const Dealer = require('../models/Dealer');
const DealerBill = require('../models/DealerBill');
const DealerProduct = require('../models/DealerProduct');

const calculateAmountFromMargin = (rate, margin) => {
  const normalizedRate = Number(rate || 0);
  const normalizedMargin = Number(margin || 0);
  const divisor = 100 + normalizedMargin;

  if (!Number.isFinite(normalizedRate) || !Number.isFinite(normalizedMargin) || divisor <= 0) {
    return 0;
  }

  return (normalizedRate * 100) / divisor;
};

const buildBillSearchValue = (bill) => {
  const itemValues = Array.isArray(bill?.items)
    ? bill.items.flatMap((item) => [item?.mrp, item?.productName, item?.productRate, item?.amount, item?.quantity, item?.total])
    : [];

  return [
    bill?._id,
    bill?.billDate,
    bill?.kattaCount,
    bill?.totalAmount,
    bill?.dealerId?._id,
    bill?.dealerId?.dealerName,
    bill?.dealerId?.contactNo,
    bill?.dealerId?.city,
    bill?.userId?._id,
    bill?.userId?.name,
    bill?.userId?.email,
    ...itemValues,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();
};

const buildDealerBillPayload = async ({ dealerId, billDate, kattaCount, items }) => {
  if (!dealerId || !billDate) {
    return {
      error: {
        status: 400,
        message: 'dealerId and billDate are required',
      },
    };
  }

  const normalizedBillDate = new Date(billDate);
  if (Number.isNaN(normalizedBillDate.getTime())) {
    return {
      error: {
        status: 400,
        message: 'billDate must be a valid date',
      },
    };
  }

  const normalizedKattaCount = Number(kattaCount);
  if (!Number.isFinite(normalizedKattaCount) || normalizedKattaCount < 0) {
    return {
      error: {
        status: 400,
        message: 'kattaCount must be a valid number',
      },
    };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: {
        status: 400,
        message: 'At least one product quantity is required',
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

  const normalizedItems = items
    .map((item) => ({
      productId: item?.productId ? String(item.productId) : undefined,
      productName: String(item?.productName || '').trim(),
      mrp: Number(item?.mrp || 0),
      productRate: Number(item?.productRate || 0),
      quantity: Number(item?.quantity),
    }))
    .filter(
      (item) =>
        item.productName &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(item.mrp) &&
        item.mrp >= 0 &&
        Number.isFinite(item.productRate) &&
        item.productRate >= 0,
    );

  if (normalizedItems.length === 0) {
    return {
      error: {
        status: 400,
        message: 'Please enter at least one valid bill product',
      },
    };
  }

  const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId).filter(Boolean))];
  const products = uniqueProductIds.length
    ? await DealerProduct.find({ _id: { $in: uniqueProductIds } }).sort({ productName: 1 })
    : [];

  if (products.length !== uniqueProductIds.length) {
    return {
      error: {
        status: 400,
        message: 'One or more selected products were not found',
      },
    };
  }

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const billItems = normalizedItems.map((item) => {
    const linkedProduct = item.productId ? productMap.get(String(item.productId)) : null;
    const quantity = Math.trunc(item.quantity);
    const rate = item.productRate;
    const mrp = linkedProduct ? Number(linkedProduct.mrp) : item.mrp;
    const productName = linkedProduct ? linkedProduct.productName : item.productName;
    const amount = linkedProduct
      ? calculateAmountFromMargin(rate, dealer.margin)
      : rate;

    return {
      productId: linkedProduct?._id || null,
      mrp,
      productName,
      productRate: rate,
      amount,
      quantity,
      total: amount * quantity,
    };
  });

  return {
    payload: {
      dealerId,
      billDate: normalizedBillDate,
      items: billItems,
      kattaCount: Math.trunc(normalizedKattaCount),
      totalAmount: billItems.reduce((sum, item) => sum + item.total, 0),
    },
  };
};

const populateDealerBill = (query) =>
  query
    .populate('userId', 'name email roleId')
    .populate('dealerId', 'dealerName contactNo city margin isActive')
    .populate('items.productId', 'mrp productName productRate');

const createDealerBill = async (req, res) => {
  try {
    const { dealerId, billDate, kattaCount, items } = req.body;
    const prepared = await buildDealerBillPayload({ dealerId, billDate, kattaCount, items });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const created = await DealerBill.create({
      userId: req.user._id,
      ...prepared.payload,
    });

    const populated = await populateDealerBill(DealerBill.findById(created._id));

    return res.status(201).json({
      success: true,
      message: 'Dealer bill created successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create dealer bill',
      error: error.message,
    });
  }
};

const getAllDealerBills = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const bills = await populateDealerBill(DealerBill.find({}).sort({ billDate: -1, createdAt: -1 }));

    const filteredBills = search
      ? bills.filter((bill) => buildBillSearchValue(bill).includes(search))
      : bills;

    return res.status(200).json({
      success: true,
      message: 'Dealer bills fetched successfully',
      data: filteredBills,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dealer bills',
      error: error.message,
    });
  }
};

const updateDealerBill = async (req, res) => {
  try {
    const existingBill = await DealerBill.findById(req.params.id);
    if (!existingBill) {
      return res.status(404).json({
        success: false,
        message: 'Dealer bill not found',
      });
    }

    const { dealerId, billDate, kattaCount, items } = req.body;
    const prepared = await buildDealerBillPayload({ dealerId, billDate, kattaCount, items });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    existingBill.dealerId = prepared.payload.dealerId;
    existingBill.billDate = prepared.payload.billDate;
    existingBill.items = prepared.payload.items;
    existingBill.kattaCount = prepared.payload.kattaCount;
    existingBill.totalAmount = prepared.payload.totalAmount;
    await existingBill.save();

    const populated = await populateDealerBill(DealerBill.findById(existingBill._id));

    return res.status(200).json({
      success: true,
      message: 'Dealer bill updated successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update dealer bill',
      error: error.message,
    });
  }
};

const deleteDealerBill = async (req, res) => {
  try {
    const deleted = await DealerBill.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Dealer bill not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Dealer bill deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dealer bill',
      error: error.message,
    });
  }
};

module.exports = {
  createDealerBill,
  getAllDealerBills,
  updateDealerBill,
  deleteDealerBill,
};

