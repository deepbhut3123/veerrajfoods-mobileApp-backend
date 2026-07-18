const OnlineOrder = require('../models/OnlineOrder');
const OnlineProduct = require('../models/OnlineProduct');
const OnlineStockEntry = require('../models/OnlineStockEntry');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeProductPayload = (payload = {}) => ({
  name: String(payload.name || '').trim(),
  weight: String(payload.weight || '').trim(),
  mrp: Number(payload.mrp),
});

const reconcileOnlineProductStocks = async () => {
  const [products, stockEntries, orders] = await Promise.all([
    OnlineProduct.find({}),
    OnlineStockEntry.find({}).select('items'),
    OnlineOrder.find({}).select('items'),
  ]);

  const quantityMap = new Map();

  stockEntries.forEach((entry) => {
    (entry.items || []).forEach((item) => {
      const productId = String(item.productId || '');
      if (!productId) return;
      quantityMap.set(productId, Number(quantityMap.get(productId) || 0) + Number(item.quantity || 0));
    });
  });

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const productId = String(item.productId || '');
      if (!productId) return;
      quantityMap.set(productId, Number(quantityMap.get(productId) || 0) - Number(item.quantity || 0));
    });
  });

  const updates = products
    .map((product) => {
      const nextStock = Math.max(0, Number(quantityMap.get(String(product._id)) || 0));
      return Number(product.currentStock || 0) !== nextStock
        ? OnlineProduct.updateOne({ _id: product._id }, { $set: { currentStock: nextStock } })
        : null;
    })
    .filter(Boolean);

  if (updates.length) {
    await Promise.all(updates);
  }
};

const getAllOnlineProducts = async (req, res) => {
  try {
    await reconcileOnlineProductStocks();

    const search = String(req.query.search || '').trim();
    const filter = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { name: regex },
        { weight: regex },
      ];
    }

    const products = await OnlineProduct.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Online products fetched successfully',
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online products',
      error: error.message,
    });
  }
};

const getOnlineProductById = async (req, res) => {
  try {
    await reconcileOnlineProductStocks();

    const product = await OnlineProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Online product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Online product fetched successfully',
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online product',
      error: error.message,
    });
  }
};

const createOnlineProduct = async (req, res) => {
  try {
    const { name, weight, mrp } = normalizeProductPayload(req.body);

    if (!name || !weight || !Number.isFinite(mrp)) {
      return res.status(400).json({
        success: false,
        message: 'name, weight and mrp are required',
      });
    }

    const product = await OnlineProduct.create({
      name,
      weight,
      mrp,
      currentStock: 0,
    });

    return res.status(201).json({
      success: true,
      message: 'Online product created successfully',
      data: product,
    });
  } catch (error) {
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Invalid online product data' : 'Failed to create online product',
      error: error.message,
    });
  }
};

const updateOnlineProduct = async (req, res) => {
  try {
    const product = await OnlineProduct.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Online product not found',
      });
    }

    const { name, weight, mrp } = normalizeProductPayload(req.body);

    if (!name || !weight || !Number.isFinite(mrp)) {
      return res.status(400).json({
        success: false,
        message: 'name, weight and mrp are required',
      });
    }

    product.name = name;
    product.weight = weight;
    product.mrp = mrp;

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Online product updated successfully',
      data: product,
    });
  } catch (error) {
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Invalid online product data' : 'Failed to update online product',
      error: error.message,
    });
  }
};

const deleteOnlineProduct = async (req, res) => {
  try {
    const product = await OnlineProduct.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Online product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Online product deleted successfully',
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete online product',
      error: error.message,
    });
  }
};

module.exports = {
  getAllOnlineProducts,
  getOnlineProductById,
  createOnlineProduct,
  updateOnlineProduct,
  deleteOnlineProduct,
};
