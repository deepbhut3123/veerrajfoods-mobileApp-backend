const Product = require('../models/Product');
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

const normalizeProductName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const addQuantityToMap = (quantityMap, key, quantityDelta) => {
  if (!key) {
    return;
  }

  const currentQuantity = Number(quantityMap.get(key) || 0);
  quantityMap.set(key, currentQuantity + Number(quantityDelta || 0));
};

const buildQuantityMapFromBillItems = (items = [], multiplier = 1) => {
  const quantityMap = new Map();

  items.forEach((item) => {
    const productId = item?.stockProductId ? String(item.stockProductId) : '';
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
        message: 'One or more stock products were not found',
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
        message: `Insufficient stock for ${insufficientProducts
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

const buildStockProductCatalog = async () => {
  const products = await Product.find({}).select('_id productName mrp productRate');
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const productNameMap = new Map();

  products.forEach((product) => {
    const normalizedName = normalizeProductName(product.productName);
    if (!normalizedName) {
      return;
    }

    const existingProducts = productNameMap.get(normalizedName) || [];
    existingProducts.push(product);
    productNameMap.set(normalizedName, existingProducts);
  });

  return {
    productMap,
    productNameMap,
  };
};

const resolveStockProduct = ({ stockProductId, productName, mrp }, stockCatalog) => {
  const normalizedStockProductId = stockProductId ? String(stockProductId).trim() : '';
  if (normalizedStockProductId && stockCatalog.productMap.has(normalizedStockProductId)) {
    return {
      product: stockCatalog.productMap.get(normalizedStockProductId),
      reason: null,
    };
  }

  const normalizedName = normalizeProductName(productName);
  const candidates = stockCatalog.productNameMap.get(normalizedName) || [];

  if (!candidates.length) {
    return {
      product: null,
      reason: 'missing',
    };
  }

  if (candidates.length === 1) {
    return {
      product: candidates[0],
      reason: null,
    };
  }

  const normalizedMrp = Number(mrp || 0);
  const exactMrpMatches = candidates.filter((candidate) => Number(candidate.mrp || 0) === normalizedMrp);

  if (exactMrpMatches.length === 1) {
    return {
      product: exactMrpMatches[0],
      reason: null,
    };
  }

  return {
    product: null,
    reason: 'ambiguous',
  };
};

const getStockProductResolutionError = (productName, reason) => {
  const label = String(productName || 'Unknown Product').trim() || 'Unknown Product';

  if (reason === 'ambiguous') {
    return `Multiple stock products matched "${label}". Please keep one unique stock product name or align MRP.`;
  }

  return `Stock product not found for "${label}". Please create the matching retailer stock product first.`;
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
  const stockCatalog = await buildStockProductCatalog();

  if (products.length !== uniqueProductIds.length) {
    return {
      error: {
        status: 400,
        message: 'One or more selected products were not found',
      },
    };
  }

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const stockResolutionErrors = [];
  const billItems = normalizedItems.map((item) => {
    const linkedProduct = item.productId ? productMap.get(String(item.productId)) : null;
    const quantity = Math.trunc(item.quantity);
    const rate = item.productRate;
    const mrp = linkedProduct ? Number(linkedProduct.mrp) : item.mrp;
    const productName = linkedProduct ? linkedProduct.productName : item.productName;
    const amount = linkedProduct
      ? calculateAmountFromMargin(rate, dealer.margin)
      : rate;
    const stockResolution = resolveStockProduct(
      {
        productName,
        mrp,
      },
      stockCatalog,
    );

    if (!stockResolution.product) {
      stockResolutionErrors.push(getStockProductResolutionError(productName, stockResolution.reason));
    }

    return {
      productId: linkedProduct?._id || null,
      stockProductId: stockResolution.product?._id || null,
      mrp,
      productName,
      productRate: rate,
      amount,
      quantity,
      total: amount * quantity,
    };
  });

  if (stockResolutionErrors.length) {
    return {
      error: {
        status: 400,
        message: [...new Set(stockResolutionErrors)].join(' | '),
      },
    };
  }

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
    .populate('items.productId', 'mrp productName productRate')
    .populate('items.stockProductId', 'mrp productName productRate currentStock');

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

    const stockAdjustment = await applyProductStockAdjustments(
      buildQuantityMapFromBillItems(prepared.payload.items, -1)
    );

    if (stockAdjustment.error) {
      return res.status(stockAdjustment.error.status).json({
        success: false,
        message: stockAdjustment.error.message,
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
    const dealerId = String(req.query?.dealerId || '').trim();
    const fromDate = String(req.query?.fromDate || '').trim();
    const toDate = String(req.query?.toDate || '').trim();
    const query = {};

    if (dealerId) {
      query.dealerId = dealerId;
    }

    if (fromDate || toDate) {
      query.billDate = {};

      if (fromDate) {
        const parsedFromDate = new Date(fromDate);
        if (Number.isNaN(parsedFromDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'fromDate must be a valid date',
          });
        }

        parsedFromDate.setHours(0, 0, 0, 0);
        query.billDate.$gte = parsedFromDate;
      }

      if (toDate) {
        const parsedToDate = new Date(toDate);
        if (Number.isNaN(parsedToDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'toDate must be a valid date',
          });
        }

        parsedToDate.setHours(23, 59, 59, 999);
        query.billDate.$lte = parsedToDate;
      }
    }

    const bills = await populateDealerBill(
      DealerBill.find(query).sort({ billDate: -1, createdAt: -1 }),
    );

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
    const prepared = await buildDealerBillPayload({
      dealerId,
      billDate,
      kattaCount,
      items,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const stockAdjustment = await applyProductStockAdjustments(
      mergeQuantityMaps(
        buildQuantityMapFromBillItems(existingBill.items, 1),
        buildQuantityMapFromBillItems(prepared.payload.items, -1),
      )
    );

    if (stockAdjustment.error) {
      return res.status(stockAdjustment.error.status).json({
        success: false,
        message: stockAdjustment.error.message,
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
    const existingBill = await DealerBill.findById(req.params.id);

    if (!existingBill) {
      return res.status(404).json({
        success: false,
        message: 'Dealer bill not found',
      });
    }

    const stockAdjustment = await applyProductStockAdjustments(
      buildQuantityMapFromBillItems(existingBill.items, 1)
    );

    if (stockAdjustment.error) {
      return res.status(stockAdjustment.error.status).json({
        success: false,
        message: stockAdjustment.error.message,
      });
    }

    const deleted = await DealerBill.findByIdAndDelete(req.params.id);

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

