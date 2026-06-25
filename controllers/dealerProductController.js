const DealerProduct = require('../models/DealerProduct');

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

const normalizeDealerProductSequences = async () => {
  const products = await DealerProduct.find({})
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
    await DealerProduct.bulkWrite(operations);
  }
};

const getDealerProductsWithSequenceOrder = () =>
  DealerProduct.find({})
    .populate('userId', 'name email roleId')
    .sort({ sequence: 1, createdAt: 1, _id: 1 });

const getNextSequence = async () => {
  const lastProduct = await DealerProduct.findOne({})
    .sort({ sequence: -1, createdAt: -1, _id: -1 })
    .select('sequence');

  const currentSequence = Number(lastProduct?.sequence);
  return Number.isFinite(currentSequence) && currentSequence > 0 ? currentSequence + 1 : 1;
};

const buildProductSearchValue = (product) =>
  [
    product?._id,
    product?.mrp,
    product?.productName,
    product?.productRate,
    product?.userId?.name,
    product?.userId?.email,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();

const createDealerProduct = async (req, res) => {
  try {
    const { mrp, productName, productRate } = req.body;

    if (!productName || !String(productName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'productName is required',
      });
    }

    const parsedMrp = normalizeNumber(mrp);
    const parsedRate = normalizeNumber(productRate);
    if (!Number.isFinite(parsedMrp) || !Number.isFinite(parsedRate)) {
      return res.status(400).json({
        success: false,
        message: 'mrp and productRate must be valid numbers',
      });
    }

    const created = await DealerProduct.create({
      userId: req.user._id,
      mrp: parsedMrp,
      productName: String(productName).trim(),
      productRate: parsedRate,
      sequence: await getNextSequence(),
    });

    const populated = await DealerProduct.findById(created._id).populate('userId', 'name email roleId');

    return res.status(201).json({
      success: true,
      message: 'Dealer product created successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid dealer product data'),
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create dealer product',
      error: error.message,
    });
  }
};

const getAllDealerProducts = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    await normalizeDealerProductSequences();
    const products = await getDealerProductsWithSequenceOrder();

    const filteredProducts = search
      ? products.filter((product) => buildProductSearchValue(product).includes(search))
      : products;

    return res.status(200).json({
      success: true,
      message: 'Dealer products fetched successfully',
      data: filteredProducts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dealer products',
      error: error.message,
    });
  }
};

const updateDealerProduct = async (req, res) => {
  try {
    const { mrp, productName, productRate } = req.body;

    if (!productName || !String(productName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'productName is required',
      });
    }

    const parsedMrp = normalizeNumber(mrp);
    const parsedRate = normalizeNumber(productRate);
    if (!Number.isFinite(parsedMrp) || !Number.isFinite(parsedRate)) {
      return res.status(400).json({
        success: false,
        message: 'mrp and productRate must be valid numbers',
      });
    }

    const updated = await DealerProduct.findByIdAndUpdate(
      req.params.id,
      {
        mrp: parsedMrp,
        productName: String(productName).trim(),
        productRate: parsedRate,
      },
      { returnDocument: 'after', runValidators: true }
    ).populate('userId', 'name email roleId');

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Dealer product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Dealer product updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid dealer product data'),
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update dealer product',
      error: error.message,
    });
  }
};

const reorderDealerProducts = async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'productIds must be a non-empty array',
      });
    }

    const uniqueProductIds = [...new Set(productIds.map((id) => String(id)))];
    const allProducts = await DealerProduct.find({}).select('_id');

    if (uniqueProductIds.length !== allProducts.length) {
      return res.status(400).json({
        success: false,
        message: 'Please send sequence for all dealer products',
      });
    }

    const existingIds = new Set(allProducts.map((product) => String(product._id)));
    const hasInvalidId = uniqueProductIds.some((id) => !existingIds.has(id));

    if (hasInvalidId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dealer product ids provided for sequence update',
      });
    }

    await DealerProduct.bulkWrite(
      uniqueProductIds.map((productId, index) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $set: { sequence: index + 1 } },
        },
      }))
    );

    const products = await getDealerProductsWithSequenceOrder();

    return res.status(200).json({
      success: true,
      message: 'Dealer product sequence updated successfully',
      data: products,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder dealer products',
      error: error.message,
    });
  }
};

const deleteDealerProduct = async (req, res) => {
  try {
    const deleted = await DealerProduct.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Dealer product not found',
      });
    }

    await normalizeDealerProductSequences();

    return res.status(200).json({
      success: true,
      message: 'Dealer product deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dealer product',
      error: error.message,
    });
  }
};

module.exports = {
  createDealerProduct,
  getAllDealerProducts,
  updateDealerProduct,
  reorderDealerProducts,
  deleteDealerProduct,
};
