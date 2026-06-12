const Bill = require('../models/Bill');
const Product = require('../models/Product');
const Route = require('../models/Route');
const Shop = require('../models/Shop');

const createBill = async (req, res) => {
  try {
    const { routeId, shopId, items } = req.body;

    if (!routeId || !shopId) {
      return res.status(400).json({
        success: false,
        message: 'routeId and shopId are required',
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product quantity is required',
      });
    }

    const route = await Route.findOne({ _id: routeId, userId: req.user._id });
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    const shop = await Shop.findOne({ _id: shopId, routeId, userId: req.user._id });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found for the selected route',
      });
    }

    const normalizedItems = items
      .map((item) => ({
        productId: item?.productId,
        quantity: Number(item?.quantity),
      }))
      .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (normalizedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter quantity for at least one product',
      });
    }

    const uniqueProductIds = [...new Set(normalizedItems.map((item) => String(item.productId)))];
    const products = await Product.find({ _id: { $in: uniqueProductIds } }).sort({ productName: 1 });

    if (products.length !== uniqueProductIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected products were not found',
      });
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

    const created = await Bill.create({
      userId: req.user._id,
      routeId,
      shopId,
      items: billItems,
      totalAmount,
      status: 'ordered',
    });

    const populated = await Bill.findById(created._id)
      .populate('routeId', 'routeName cityName')
      .populate('shopId', 'shopName shopAddress mobileNumber')
      .sort({ createdAt: -1 });

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

const getBillProducts = async (_req, res) => {
  try {
    const products = await Product.find({})
      .populate('userId', 'name email roleId')
      .sort({ productName: 1 });

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

module.exports = {
  createBill,
  getMyBills,
  getBillProducts,
};
