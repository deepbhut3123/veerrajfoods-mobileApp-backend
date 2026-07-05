const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockEntry = require('../models/StockEntry');

const normalizeNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return NaN;
  }

  return Number(value);
};

const addQuantityToMap = (quantityMap, productId, quantityDelta) => {
  if (!productId) {
    return;
  }

  const currentValue = Number(quantityMap.get(productId) || 0);
  quantityMap.set(productId, currentValue + Number(quantityDelta || 0));
};

const buildQuantityMapFromItems = (items = [], multiplier = 1) => {
  const quantityMap = new Map();

  items.forEach((item) => {
    const productId = item?.productId ? String(item.productId) : '';
    const quantity = Math.trunc(Number(item?.quantity || 0));

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    addQuantityToMap(quantityMap, productId, quantity * multiplier);
  });

  return quantityMap;
};

const mergeQuantityMaps = (...maps) => {
  const merged = new Map();

  maps.forEach((map) => {
    map.forEach((value, key) => addQuantityToMap(merged, key, value));
  });

  return merged;
};

const applyProductStockAdjustments = async (quantityMap) => {
  const productIds = Array.from(quantityMap.keys()).filter(Boolean);

  if (!productIds.length) {
    return { error: null };
  }

  const products = await Product.find({ _id: { $in: productIds } }).select('_id productName currentStock');

  if (products.length !== productIds.length) {
    return {
      error: {
        status: 400,
        message: 'One or more selected products were not found',
      },
    };
  }

  const insufficientProducts = products
    .map((product) => {
      const delta = Number(quantityMap.get(String(product._id)) || 0);
      const nextStock = Number(product.currentStock || 0) + delta;

      return {
        productName: product.productName,
        nextStock,
      };
    })
    .filter((item) => item.nextStock < 0);

  if (insufficientProducts.length) {
    return {
      error: {
        status: 400,
        message: `Current stock cannot go below zero for ${insufficientProducts
          .map((item) => item.productName)
          .join(', ')}`,
      },
    };
  }

  await Promise.all(
    products.map((product) => {
      const delta = Number(quantityMap.get(String(product._id)) || 0);
      if (!delta) {
        return Promise.resolve();
      }

      return Product.updateOne(
        { _id: product._id },
        { $inc: { currentStock: delta } },
      );
    })
  );

  return { error: null };
};

const buildStockEntryPayload = async ({ entryDate, items, userId }) => {
  const normalizedDate = String(entryDate || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return {
      error: {
        status: 400,
        message: 'entryDate must be in YYYY-MM-DD format',
      },
    };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: {
        status: 400,
        message: 'At least one stock item is required',
      },
    };
  }

  const normalizedItems = items
    .map((item) => ({
      productId: String(item?.productId || '').trim(),
      quantity: normalizeNumber(item?.quantity),
    }))
    .filter(
      (item) =>
        item.productId &&
        mongoose.Types.ObjectId.isValid(item.productId) &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );

  if (normalizedItems.length === 0) {
    return {
      error: {
        status: 400,
        message: 'Please enter quantity for at least one product',
      },
    };
  }

  const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: uniqueProductIds } }).select(
    '_id productName mrp productRate'
  );

  if (products.length !== uniqueProductIds.length) {
    return {
      error: {
        status: 400,
        message: 'One or more selected products were not found',
      },
    };
  }

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const payloadItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);
    const quantity = Math.trunc(item.quantity);
    const mrp = Number(product.mrp || 0);
    const productRate = Number(product.productRate || 0);

    return {
      productId: product._id,
      productName: product.productName,
      mrp,
      productRate,
      quantity,
      total: productRate * quantity,
    };
  });

  return {
    payload: {
      userId,
      entryDate: normalizedDate,
      items: payloadItems,
      totalAmount: payloadItems.reduce((sum, item) => sum + item.total, 0),
    },
  };
};

const getPopulatedStockEntryQuery = () =>
  StockEntry.find({})
    .populate('userId', 'name email roleId')
    .populate('items.productId', 'productName mrp productRate')
    .sort({ entryDate: -1, createdAt: -1 });

const createStockEntry = async (req, res) => {
  try {
    const prepared = await buildStockEntryPayload({
      entryDate: req.body?.entryDate,
      items: req.body?.items,
      userId: req.user._id,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const stockAdjustment = await applyProductStockAdjustments(
      buildQuantityMapFromItems(prepared.payload.items, 1)
    );

    if (stockAdjustment.error) {
      return res.status(stockAdjustment.error.status).json({
        success: false,
        message: stockAdjustment.error.message,
      });
    }

    const created = await StockEntry.create(prepared.payload);
    const populated = await StockEntry.findById(created._id)
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'productName mrp productRate');

    return res.status(201).json({
      success: true,
      message: 'Stock entry created successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create stock entry',
      error: error.message,
    });
  }
};

const getAllStockEntries = async (_req, res) => {
  try {
    const entries = await getPopulatedStockEntryQuery();

    return res.status(200).json({
      success: true,
      message: 'Stock entries fetched successfully',
      data: entries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock entries',
      error: error.message,
    });
  }
};

const getStockEntryById = async (req, res) => {
  try {
    const entry = await StockEntry.findById(req.params.id)
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'productName mrp productRate');

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Stock entry fetched successfully',
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock entry',
      error: error.message,
    });
  }
};

const updateStockEntry = async (req, res) => {
  try {
    const existingEntry = await StockEntry.findById(req.params.id);

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found',
      });
    }

    const prepared = await buildStockEntryPayload({
      entryDate: req.body?.entryDate,
      items: req.body?.items,
      userId: existingEntry.userId,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const existingQuantityMap = buildQuantityMapFromItems(existingEntry.items, -1);
    const newQuantityMap = buildQuantityMapFromItems(prepared.payload.items, 1);
    const stockAdjustment = await applyProductStockAdjustments(
      mergeQuantityMaps(existingQuantityMap, newQuantityMap)
    );

    if (stockAdjustment.error) {
      return res.status(stockAdjustment.error.status).json({
        success: false,
        message: stockAdjustment.error.message,
      });
    }

    const updated = await StockEntry.findByIdAndUpdate(req.params.id, prepared.payload, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'productName mrp productRate');

    return res.status(200).json({
      success: true,
      message: 'Stock entry updated successfully',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update stock entry',
      error: error.message,
    });
  }
};

const deleteStockEntry = async (req, res) => {
  try {
    const existingEntry = await StockEntry.findById(req.params.id);

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found',
      });
    }

    const stockAdjustment = await applyProductStockAdjustments(
      buildQuantityMapFromItems(existingEntry.items, -1)
    );

    if (stockAdjustment.error) {
      return res.status(stockAdjustment.error.status).json({
        success: false,
        message: stockAdjustment.error.message,
      });
    }

    const deleted = await StockEntry.findByIdAndDelete(req.params.id)
      .populate('userId', 'name email roleId')
      .populate('items.productId', 'productName mrp productRate');

    return res.status(200).json({
      success: true,
      message: 'Stock entry deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete stock entry',
      error: error.message,
    });
  }
};

module.exports = {
  createStockEntry,
  getAllStockEntries,
  getStockEntryById,
  updateStockEntry,
  deleteStockEntry,
};
