const Bill = require('../models/Bill');
const Product = require('../models/Product');
const Route = require('../models/Route');
const Shop = require('../models/Shop');

const isAdmin = (req) => req?.user?.roleId === 1;

const getUserScope = (req) => (isAdmin(req) ? {} : { userId: req.user._id });

const buildBillSearchValue = (bill) => {
  const itemValues = Array.isArray(bill?.items)
    ? bill.items.flatMap((item) => [
        item?.productName,
        item?.quantity,
        item?.productRate,
        item?.total,
        typeof item?.productId === 'object' ? item?.productId?.productName : '',
        typeof item?.productId === 'object' ? item?.productId?.mrp : '',
      ])
    : [];

  return [
    bill?._id,
    bill?.billNo,
    bill?.invoiceNo,
    bill?.billNumber,
    bill?.customerName,
    bill?.partyName,
    bill?.shopName,
    bill?.status,
    bill?.amount,
    bill?.billAmount,
    bill?.totalAmount,
    bill?.grandTotal,
    bill?.netAmount,
    bill?.createdAt,
    bill?.updatedAt,
    bill?.routeId?._id,
    bill?.routeId?.routeName,
    bill?.routeId?.cityName,
    bill?.shopId?._id,
    bill?.shopId?.shopName,
    bill?.shopId?.shopAddress,
    bill?.shopId?.mobileNumber,
    bill?.customerId?.name,
    bill?.userId?._id,
    bill?.userId?.name,
    bill?.userId?.email,
    ...itemValues,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();
};

const buildBillPayload = async ({ routeId, shopId, items, req }) => {
  if (!routeId || !shopId) {
    return {
      error: {
        status: 400,
        message: 'routeId and shopId are required',
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

  const scope = getUserScope(req);

  const route = await Route.findOne({ _id: routeId, ...scope });
  if (!route) {
    return {
      error: {
        status: 404,
        message: 'Route not found',
      },
    };
  }

  const shop = await Shop.findOne({ _id: shopId, routeId, ...scope });
  if (!shop) {
    return {
      error: {
        status: 404,
        message: 'Shop not found for the selected route',
      },
    };
  }

  const normalizedItems = items
    .map((item) => ({
      productId: item?.productId,
      quantity: Number(item?.quantity),
    }))
    .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

  if (normalizedItems.length === 0) {
    return {
      error: {
        status: 400,
        message: 'Please enter quantity for at least one product',
      },
    };
  }

  const uniqueProductIds = [...new Set(normalizedItems.map((item) => String(item.productId)))];
  const products = await Product.find({ _id: { $in: uniqueProductIds } }).sort({ productName: 1 });

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
    const product = productMap.get(String(item.productId));
    const quantity = Math.trunc(item.quantity);
    const rate = Number(product.productRate);
    return {
      productId: product._id,
      productName: product.productName,
      productRate: rate,
      quantity,
      total: rate * quantity,
    };
  });

  const totalAmount = billItems.reduce((sum, item) => sum + item.total, 0);

  return {
    payload: {
      routeId,
      shopId,
      items: billItems,
      totalAmount,
    },
  };
};

const createBill = async (req, res) => {
  try {
    const { routeId, shopId, items } = req.body;

    const prepared = await buildBillPayload({
      routeId,
      shopId,
      items,
      req,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const created = await Bill.create({
      userId: req.user._id,
      ...prepared.payload,
      status: 'ordered',
    });

    const populated = await Bill.findById(created._id)
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'mrp productName')
      .populate('routeId', 'routeName cityName')
      .populate('shopId', 'shopName shopAddress mobileNumber');

    return res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create bill',
      error: error.message,
    });
  }
};

const getMyBills = async (req, res) => {
  try {
    const bills = await Bill.find({ userId: req.user._id })
      .populate('routeId', 'routeName cityName')
      .populate('shopId', 'shopName shopAddress mobileNumber')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Bills fetched successfully',
      data: bills,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bills',
      error: error.message,
    });
  }
};

const getAllAdminBills = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();

    const bills = await Bill.find({})
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'mrp productName')
      .populate('routeId', 'routeName cityName')
      .populate('shopId', 'shopName shopAddress mobileNumber')
      .sort({ createdAt: -1 });

    const filteredBills = search
      ? bills.filter((bill) => buildBillSearchValue(bill).includes(search))
      : bills;

    return res.status(200).json({
      success: true,
      message: 'All bills fetched successfully',
      data: filteredBills,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch all bills',
      error: error.message,
    });
  }
};

const markBillsAsShipped = async (req, res) => {
  try {
    const billIds = Array.isArray(req.body?.billIds)
      ? req.body.billIds.map((id) => String(id)).filter(Boolean)
      : [];

    if (billIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'billIds is required',
      });
    }

    const existingBills = await Bill.find({ _id: { $in: billIds } }).select('_id status');

    if (existingBills.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bills found for the selected ids',
      });
    }

    const updatableBillIds = existingBills
      .filter((bill) => bill.status !== 'cancelled')
      .map((bill) => bill._id);

    if (updatableBillIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancelled bills cannot be marked as shipped',
      });
    }

    await Bill.updateMany(
      { _id: { $in: updatableBillIds } },
      { $set: { status: 'shipped' } }
    );

    return res.status(200).json({
      success: true,
      message: 'Selected bills marked as shipped',
      data: {
        updatedCount: updatableBillIds.length,
        skippedCount: existingBills.length - updatableBillIds.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update bill status',
      error: error.message,
    });
  }
};

const markBillsAsCompleted = async (req, res) => {
  try {
    const billIds = Array.isArray(req.body?.billIds)
      ? req.body.billIds.map((id) => String(id)).filter(Boolean)
      : [];

    if (billIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'billIds is required',
      });
    }

    const existingBills = await Bill.find({ _id: { $in: billIds } }).select('_id status');

    if (existingBills.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bills found for the selected ids',
      });
    }

    const updatableBillIds = existingBills
      .filter((bill) => !['cancelled', 'completed'].includes(String(bill.status || '').toLowerCase()))
      .map((bill) => bill._id);

    if (updatableBillIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected bills are already completed or cancelled',
      });
    }

    await Bill.updateMany(
      { _id: { $in: updatableBillIds } },
      { $set: { status: 'completed' } }
    );

    return res.status(200).json({
      success: true,
      message: 'Selected bills marked as completed',
      data: {
        updatedCount: updatableBillIds.length,
        skippedCount: existingBills.length - updatableBillIds.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update bill status',
      error: error.message,
    });
  }
};

const getBillProducts = async (_req, res) => {
  try {
    const products = await Product.find({})
      .populate('userId', 'name email roleId')
      .sort({ sequence: 1, createdAt: 1, _id: 1 });

    return res.status(200).json({
      success: true,
      message: 'Products fetched successfully',
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};
const updateBill = async (req, res) => {
  try {
    const { routeId, shopId, items } = req.body;
    const existingBill = await Bill.findOne({ _id: req.params.id, ...getUserScope(req) });

    if (!existingBill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    if (!isAdmin(req) && existingBill.status !== 'ordered') {
      return res.status(400).json({
        success: false,
        message: 'Only ordered bills can be updated',
      });
    }

    const prepared = await buildBillPayload({
      routeId,
      shopId,
      items,
      req,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    existingBill.routeId = prepared.payload.routeId;
    existingBill.shopId = prepared.payload.shopId;
    existingBill.items = prepared.payload.items;
    existingBill.totalAmount = prepared.payload.totalAmount;

    await existingBill.save();

    const populated = await Bill.findById(existingBill._id)
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'mrp productName')
      .populate('routeId', 'routeName cityName')
      .populate('shopId', 'shopName shopAddress mobileNumber');

    return res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update bill',
      error: error.message,
    });
  }
};

const deleteBill = async (req, res) => {
  try {
    const existingBill = await Bill.findOne({ _id: req.params.id, ...getUserScope(req) });

    if (!existingBill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      });
    }

    if (!isAdmin(req) && existingBill.status !== 'ordered') {
      return res.status(400).json({
        success: false,
        message: 'Only ordered bills can be deleted',
      });
    }

    await Bill.deleteOne({ _id: existingBill._id });

    return res.status(200).json({
      success: true,
      message: 'Bill deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bill',
      error: error.message,
    });
  }
};

const bulkDeleteBills = async (req, res) => {
  try {
    const billIds = Array.isArray(req.body?.billIds)
      ? req.body.billIds.map((id) => String(id)).filter(Boolean)
      : [];

    if (billIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'billIds is required',
      });
    }

    const scope = getUserScope(req);
    const bills = await Bill.find({ _id: { $in: billIds }, ...scope }).select('_id status');

    if (bills.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bills found for the selected ids',
      });
    }

    const deletableBills = isAdmin(req)
      ? bills
      : bills.filter((bill) => bill.status === 'ordered');

    if (deletableBills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Only ordered bills can be deleted',
      });
    }

    const deletableIds = deletableBills.map((bill) => bill._id);
    await Bill.deleteMany({ _id: { $in: deletableIds } });

    return res.status(200).json({
      success: true,
      message: 'Selected bills deleted successfully',
      data: {
        deletedCount: deletableIds.length,
        skippedCount: bills.length - deletableIds.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete selected bills',
      error: error.message,
    });
  }
};

module.exports = {
  createBill,
  updateBill,
  deleteBill,
  bulkDeleteBills,
  getMyBills,
  getAllAdminBills,
  getBillProducts,
  markBillsAsShipped,
  markBillsAsCompleted,
};







