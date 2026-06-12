const Product = require('../models/Product');

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

const createProduct = async (req, res) => {
  try {
    const { productName, mrp, productRate } = req.body;

    if (!productName || !String(productName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'productName is required',
      });
    }

    const parsedMrp = normalizeNumber(mrp);
    const parsedProductRate = normalizeNumber(productRate);

    if (!Number.isFinite(parsedMrp) || !Number.isFinite(parsedProductRate)) {
      return res.status(400).json({
        success: false,
        message: 'mrp and productRate must be valid numbers',
      });
    }

    const created = await Product.create({
      userId: req.user._id,
      productName: String(productName).trim(),
      mrp: parsedMrp,
      productRate: parsedProductRate,
    });

    const populated = await Product.findById(created._id).populate('userId', 'name email roleId');

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid product data'),
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
};

const getAllProducts = async (_req, res) => {
  try {
    const products = await Product.find({})
      .populate('userId', 'name email roleId')
      .sort({ createdAt: -1 });

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

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('userId', 'name email roleId');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product fetched successfully',
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { productName, mrp, productRate } = req.body;

    if (!productName || !String(productName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'productName is required',
      });
    }

    const parsedMrp = normalizeNumber(mrp);
    const parsedProductRate = normalizeNumber(productRate);

    if (!Number.isFinite(parsedMrp) || !Number.isFinite(parsedProductRate)) {
      return res.status(400).json({
        success: false,
        message: 'mrp and productRate must be valid numbers',
      });
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      {
        productName: String(productName).trim(),
        mrp: parsedMrp,
        productRate: parsedProductRate,
      },
      { new: true, runValidators: true }
    ).populate('userId', 'name email roleId');

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid product data'),
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
