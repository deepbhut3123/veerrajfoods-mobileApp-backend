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

const normalizeProductSequences = async () => {
  const products = await Product.find({})
    .sort({ sequence: 1, createdAt: 1, _id: 1 })
    .select('_id sequence');

  const operations = [];

  products.forEach((product, index) => {
    const nextSequence = index + 1;
    if (product.sequence !== nextSequence) {
      operations.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $set: { sequence: nextSequence } },
        },
      });
    }
  });

  if (operations.length > 0) {
    await Product.bulkWrite(operations);
  }
};

const getProductsWithSequenceOrder = () =>
  Product.find({})
    .populate('userId', 'name email roleId')
    .sort({ sequence: 1, createdAt: 1, _id: 1 });

const getNextSequence = async () => {
  const lastProduct = await Product.findOne({})
    .sort({ sequence: -1, createdAt: -1, _id: -1 })
    .select('sequence');

  const currentSequence = Number(lastProduct?.sequence);
  return Number.isFinite(currentSequence) && currentSequence > 0 ? currentSequence + 1 : 1;
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
      sequence: await getNextSequence(),
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
    await normalizeProductSequences();
    const products = await getProductsWithSequenceOrder();

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
      { returnDocument: 'after', runValidators: true }
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

const reorderProducts = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'productIds must be a non-empty array',
      });
    }

    const uniqueProductIds = [...new Set(productIds.map((id) => String(id)))];
    const allProducts = await Product.find({}).select('_id');

    if (uniqueProductIds.length !== allProducts.length) {
      return res.status(400).json({
        success: false,
        message: 'Please send sequence for all products',
      });
    }

    const existingIds = new Set(allProducts.map((product) => String(product._id)));
    const hasInvalidId = uniqueProductIds.some((id) => !existingIds.has(id));

    if (hasInvalidId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ids provided for sequence update',
      });
    }

    await Product.bulkWrite(
      uniqueProductIds.map((productId, index) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $set: { sequence: index + 1 } },
        },
      }))
    );

    const products = await getProductsWithSequenceOrder();

    return res.status(200).json({
      success: true,
      message: 'Product sequence updated successfully',
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder products',
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

    await normalizeProductSequences();

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
  reorderProducts,
  deleteProduct,
};
