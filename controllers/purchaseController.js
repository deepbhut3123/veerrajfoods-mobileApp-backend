const Purchase = require('../models/Purchase');

const normalizeNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return NaN;
  }

  return Number(value);
};

const roundToTwo = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const buildPurchasePayload = ({ purchaseDate, items, userId }) => {
  const normalizedDate = String(purchaseDate || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return {
      error: {
        status: 400,
        message: 'purchaseDate must be in YYYY-MM-DD format',
      },
    };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: {
        status: 400,
        message: 'At least one purchase item is required',
      },
    };
  }

  const normalizedItems = items
    .map((item) => {
      const productName = String(item?.productName || '').trim();
      const qtyKg = normalizeNumber(item?.qtyKg);
      const rate = normalizeNumber(item?.rate);
      const tax = normalizeNumber(item?.tax);
      const transport = normalizeNumber(item?.transport);

      if (
        !productName ||
        !Number.isFinite(qtyKg) ||
        qtyKg <= 0 ||
        !Number.isFinite(rate) ||
        rate < 0 ||
        !Number.isFinite(tax) ||
        tax < 0 ||
        !Number.isFinite(transport) ||
        transport < 0
      ) {
        return null;
      }

      const baseAmount = roundToTwo(qtyKg * rate);
      const taxAmount = roundToTwo((baseAmount * tax) / 100);
      const total = roundToTwo(baseAmount + taxAmount + transport);

      return {
        productName,
        qtyKg: roundToTwo(qtyKg),
        rate: roundToTwo(rate),
        tax: roundToTwo(tax),
        taxAmount,
        transport: roundToTwo(transport),
        total,
      };
    })
    .filter(Boolean);

  if (!normalizedItems.length) {
    return {
      error: {
        status: 400,
        message: 'Please enter at least one valid purchase item',
      },
    };
  }

  return {
    payload: {
      userId,
      purchaseDate: normalizedDate,
      items: normalizedItems,
      totalAmount: roundToTwo(
        normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
      ),
    },
  };
};

const populatePurchase = (query) => query.populate('userId', 'name email roleId');

const buildPurchaseSearchValue = (purchase) =>
  [
    purchase?._id,
    purchase?.purchaseDate,
    purchase?.totalAmount,
    purchase?.userId?._id,
    purchase?.userId?.name,
    purchase?.userId?.email,
    ...(purchase?.items || []).flatMap((item) => [
      item?.productName,
      item?.qtyKg,
      item?.rate,
      item?.tax,
      item?.taxAmount,
      item?.transport,
      item?.total,
    ]),
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();

const createPurchase = async (req, res) => {
  try {
    const prepared = buildPurchasePayload({
      purchaseDate: req.body?.purchaseDate,
      items: req.body?.items,
      userId: req.user._id,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const created = await Purchase.create(prepared.payload);
    const populated = await populatePurchase(Purchase.findById(created._id));

    return res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create purchase',
      error: error.message,
    });
  }
};

const getAllPurchases = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const purchases = await populatePurchase(
      Purchase.find({}).sort({ purchaseDate: -1, createdAt: -1 })
    );

    const filteredPurchases = search
      ? purchases.filter((purchase) => buildPurchaseSearchValue(purchase).includes(search))
      : purchases;

    return res.status(200).json({
      success: true,
      message: 'Purchases fetched successfully',
      data: filteredPurchases,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchases',
      error: error.message,
    });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const purchase = await populatePurchase(Purchase.findById(req.params.id));

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Purchase fetched successfully',
      data: purchase,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase',
      error: error.message,
    });
  }
};

const updatePurchase = async (req, res) => {
  try {
    const existingPurchase = await Purchase.findById(req.params.id);

    if (!existingPurchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    const prepared = buildPurchasePayload({
      purchaseDate: req.body?.purchaseDate,
      items: req.body?.items,
      userId: existingPurchase.userId,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const updated = await Purchase.findByIdAndUpdate(req.params.id, prepared.payload, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('userId', 'name email roleId');

    return res.status(200).json({
      success: true,
      message: 'Purchase updated successfully',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update purchase',
      error: error.message,
    });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const deleted = await Purchase.findByIdAndDelete(req.params.id).populate(
      'userId',
      'name email roleId'
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Purchase deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete purchase',
      error: error.message,
    });
  }
};

module.exports = {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
};
