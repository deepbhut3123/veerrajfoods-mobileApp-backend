const OnlineProduct = require('../models/OnlineProduct');
const OnlineStockEntry = require('../models/OnlineStockEntry');

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

const getEntryId = (entry) => entry?._id || entry?.id || '';

const populateEntry = (query) =>
  query.populate({
    path: 'items.productId',
    select: 'name weight mrp currentStock',
  });

const buildStockItems = async (items = []) => {
  const normalizedItems = items
    .map((item) => ({
      productId: String(item?.productId || '').trim(),
      quantity: Number(item?.quantity || 0),
    }))
    .filter((item) => item.productId && item.quantity > 0);

  if (!normalizedItems.length) {
    return { items: [], totalAmount: 0 };
  }

  const productIds = normalizedItems.map((item) => item.productId);
  const products = await OnlineProduct.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const stockItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Online product not found for id ${item.productId}`);
    }

    const mrp = Number(product.mrp || 0);
    return {
      productId: product._id,
      name: product.name,
      weight: product.weight,
      mrp,
      quantity: item.quantity,
      total: mrp * item.quantity,
    };
  });

  const totalAmount = stockItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  return { items: stockItems, totalAmount };
};

const updateProductStocks = async (deltaMap) => {
  const productIds = Array.from(deltaMap.keys());
  if (!productIds.length) {
    return;
  }

  const products = await OnlineProduct.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  for (const productId of productIds) {
    const product = productMap.get(productId);
    if (!product) {
      throw new Error(`Online product not found for id ${productId}`);
    }

    const nextStock = Number(product.currentStock || 0) + Number(deltaMap.get(productId) || 0);
    if (nextStock < 0) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    product.currentStock = nextStock;
    await product.save();
  }
};

const getAllOnlineStockEntries = async (_req, res) => {
  try {
    const entries = await populateEntry(
      OnlineStockEntry.find({}).sort({ entryDate: -1, createdAt: -1 }),
    );

    return res.status(200).json({
      success: true,
      message: 'Online stock entries fetched successfully',
      data: entries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online stock entries',
      error: error.message,
    });
  }
};

const getOnlineStockEntryById = async (req, res) => {
  try {
    const entry = await populateEntry(OnlineStockEntry.findById(req.params.id));

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Online stock entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Online stock entry fetched successfully',
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online stock entry',
      error: error.message,
    });
  }
};

const createOnlineStockEntry = async (req, res) => {
  try {
    const entryDate = String(req.body?.entryDate || '').trim();

    if (!entryDate) {
      return res.status(400).json({
        success: false,
        message: 'entryDate is required',
      });
    }

    const payload = await buildStockItems(req.body?.items || []);

    if (!payload.items.length) {
      return res.status(400).json({
        success: false,
        message: 'Please enter quantity for at least one online product',
      });
    }

    const deltaMap = new Map();
    payload.items.forEach((item) => {
      const productId = String(item.productId || '');
      deltaMap.set(productId, Number(deltaMap.get(productId) || 0) + Number(item.quantity || 0));
    });

    await updateProductStocks(deltaMap);

    const created = await OnlineStockEntry.create({
      entryDate,
      items: payload.items,
      totalAmount: payload.totalAmount,
    });

    const populated = await populateEntry(OnlineStockEntry.findById(created._id));

    return res.status(201).json({
      success: true,
      message: 'Online stock entry created successfully',
      data: populated,
    });
  } catch (error) {
    const isProductError = error?.message?.includes('Online product not found') || error?.message?.includes('Insufficient stock');
    if (isProductError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 400
          ? getValidationMessage(error, 'Invalid online stock entry data')
          : 'Failed to create online stock entry',
      error: error.message,
    });
  }
};

const updateOnlineStockEntry = async (req, res) => {
  try {
    const entry = await OnlineStockEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Online stock entry not found',
      });
    }

    const entryDate = String(req.body?.entryDate || '').trim();

    if (!entryDate) {
      return res.status(400).json({
        success: false,
        message: 'entryDate is required',
      });
    }

    const payload = await buildStockItems(req.body?.items || []);

    if (!payload.items.length) {
      return res.status(400).json({
        success: false,
        message: 'Please enter quantity for at least one online product',
      });
    }

    const deltaMap = new Map();
    (entry.items || []).forEach((item) => {
      const productId = String(item.productId || '');
      deltaMap.set(productId, Number(deltaMap.get(productId) || 0) - Number(item.quantity || 0));
    });
    payload.items.forEach((item) => {
      const productId = String(item.productId || '');
      deltaMap.set(productId, Number(deltaMap.get(productId) || 0) + Number(item.quantity || 0));
    });

    await updateProductStocks(deltaMap);

    entry.entryDate = entryDate;
    entry.items = payload.items;
    entry.totalAmount = payload.totalAmount;
    await entry.save();

    const populated = await populateEntry(OnlineStockEntry.findById(getEntryId(entry)));

    return res.status(200).json({
      success: true,
      message: 'Online stock entry updated successfully',
      data: populated,
    });
  } catch (error) {
    const isProductError = error?.message?.includes('Online product not found') || error?.message?.includes('Insufficient stock');
    if (isProductError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 400
          ? getValidationMessage(error, 'Invalid online stock entry data')
          : 'Failed to update online stock entry',
      error: error.message,
    });
  }
};

const deleteOnlineStockEntry = async (req, res) => {
  try {
    const deleted = await OnlineStockEntry.findById(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Online stock entry not found',
      });
    }

    await OnlineStockEntry.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Online stock entry deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete online stock entry',
      error: error.message,
    });
  }
};

module.exports = {
  getAllOnlineStockEntries,
  getOnlineStockEntryById,
  createOnlineStockEntry,
  updateOnlineStockEntry,
  deleteOnlineStockEntry,
};

