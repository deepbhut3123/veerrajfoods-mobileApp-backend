const PurchaseProduct = require('../models/PurchaseProduct');

const normalizeProductName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createPurchaseProduct = async (req, res) => {
  try {
    const productName = normalizeProductName(req.body?.productName);

    if (!productName) {
      return res.status(400).json({
        success: false,
        message: 'productName is required',
      });
    }

    const existing = await PurchaseProduct.findOne({
      productName: new RegExp(`^${escapeRegExp(productName)}$`, 'i'),
    }).populate('userId', 'name email roleId');

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Purchase product already exists',
        data: existing,
      });
    }

    const created = await PurchaseProduct.create({
      userId: req.user._id,
      productName,
    });

    const populated = await PurchaseProduct.findById(created._id).populate('userId', 'name email roleId');

    return res.status(201).json({
      success: true,
      message: 'Purchase product created successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create purchase product',
      error: error.message,
    });
  }
};

const getAllPurchaseProducts = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const products = await PurchaseProduct.find({})
      .populate('userId', 'name email roleId')
      .sort({ productName: 1, createdAt: 1, _id: 1 });

    const filteredProducts = search
      ? products.filter((product) => String(product?.productName || '').toLowerCase().includes(search))
      : products;

    return res.status(200).json({
      success: true,
      message: 'Purchase products fetched successfully',
      data: filteredProducts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase products',
      error: error.message,
    });
  }
};

module.exports = {
  createPurchaseProduct,
  getAllPurchaseProducts,
};
