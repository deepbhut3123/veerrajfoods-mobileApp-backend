const OnlineCustomer = require('../models/OnlineCustomer');
const OnlineOrder = require('../models/OnlineOrder');
const OnlineProduct = require('../models/OnlineProduct');

const populateOrder = (query) =>
  query
    .populate({ path: 'customerId', select: 'name phoneNumber address' })
    .populate({ path: 'items.productId', select: 'name weight mrp currentStock' });

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
      throw new Error(`Only ${Number(product.currentStock || 0)} qty available for ${product.name}`);
    }

    product.currentStock = nextStock;
    await product.save();
  }
};

const buildOrderItems = async (items = []) => {
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

  const orderItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Online product not found for id ${item.productId}`);
    }

    const availableQty = Number(product.currentStock || 0);
    if (item.quantity > availableQty) {
      throw new Error(`Only ${availableQty} qty available for ${product.name}`);
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

  const totalAmount = orderItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  return { items: orderItems, totalAmount };
};

const getAllOnlineOrders = async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim().toLowerCase();
    const paymentReceived = String(req.query?.paymentReceived || '').trim().toLowerCase();
    const fromDate = String(req.query?.fromDate || '').trim();
    const toDate = String(req.query?.toDate || '').trim();
    const query = {};

    if (status) {
      query.status = status;
    }

    if (paymentReceived === 'true' || paymentReceived === 'false') {
      query.paymentReceived = paymentReceived === 'true';
    }

    if (fromDate || toDate) {
      query.orderDate = {};

      if (fromDate) {
        query.orderDate.$gte = fromDate;
      }

      if (toDate) {
        query.orderDate.$lte = toDate;
      }
    }

    const orders = await populateOrder(OnlineOrder.find(query).sort({ orderDate: -1, createdAt: -1 }));
    return res.status(200).json({
      success: true,
      message: 'Online orders fetched successfully',
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online orders',
      error: error.message,
    });
  }
};

const getOnlineOrderById = async (req, res) => {
  try {
    const order = await populateOrder(OnlineOrder.findById(req.params.id));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Online order not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Online order fetched successfully',
      data: order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online order',
      error: error.message,
    });
  }
};

const createOnlineOrder = async (req, res) => {
  try {
    const orderDate = String(req.body?.orderDate || '').trim();
    const customerId = String(req.body?.customerId || '').trim();

    if (!orderDate || !customerId) {
      return res.status(400).json({
        success: false,
        message: 'orderDate and customerId are required',
      });
    }

    const customer = await OnlineCustomer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Online customer not found',
      });
    }

    const payload = await buildOrderItems(req.body?.items || []);
    if (!payload.items.length) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one valid order item',
      });
    }

    const deltaMap = new Map();
    payload.items.forEach((item) => {
      const productId = String(item.productId || '');
      deltaMap.set(productId, Number(deltaMap.get(productId) || 0) - Number(item.quantity || 0));
    });
    await updateProductStocks(deltaMap);

    const created = await OnlineOrder.create({
      orderDate,
      customerId: customer._id,
      customerName: customer.name,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
      status: 'ordered',
      paymentReceived: false,
      paymentAmount: 0,
      paymentType: 'online',
      paymentReceivedAt: null,
      items: payload.items,
      totalAmount: payload.totalAmount,
    });

    const populated = await populateOrder(OnlineOrder.findById(created._id));

    return res.status(201).json({
      success: true,
      message: 'Online order created successfully',
      data: populated,
    });
  } catch (error) {
    const notFoundError = error?.message?.includes('not found');
    const stockError = error?.message?.includes('qty available');
    if (notFoundError) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (stockError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Invalid online order data' : 'Failed to create online order',
      error: error.message,
    });
  }
};

const updateOnlineOrder = async (req, res) => {
  try {
    const order = await OnlineOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Online order not found',
      });
    }

    const orderDate = String(req.body?.orderDate || '').trim();
    const customerId = String(req.body?.customerId || '').trim();

    if (!orderDate || !customerId) {
      return res.status(400).json({
        success: false,
        message: 'orderDate and customerId are required',
      });
    }

    const customer = await OnlineCustomer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Online customer not found',
      });
    }

    const restoreMap = new Map();
    (order.items || []).forEach((item) => {
      const productId = String(item.productId || '');
      restoreMap.set(productId, Number(restoreMap.get(productId) || 0) + Number(item.quantity || 0));
    });
    await updateProductStocks(restoreMap);

    const payload = await buildOrderItems(req.body?.items || []);
    if (!payload.items.length) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one valid order item',
      });
    }

    const deductMap = new Map();
    payload.items.forEach((item) => {
      const productId = String(item.productId || '');
      deductMap.set(productId, Number(deductMap.get(productId) || 0) - Number(item.quantity || 0));
    });
    await updateProductStocks(deductMap);

    order.orderDate = orderDate;
    order.customerId = customer._id;
    order.customerName = customer.name;
    order.phoneNumber = customer.phoneNumber;
    order.address = customer.address;
    order.status = order.status || 'ordered';
    order.items = payload.items;
    order.totalAmount = payload.totalAmount;
    await order.save();

    const populated = await populateOrder(OnlineOrder.findById(order._id));

    return res.status(200).json({
      success: true,
      message: 'Online order updated successfully',
      data: populated,
    });
  } catch (error) {
    const notFoundError = error?.message?.includes('not found');
    const stockError = error?.message?.includes('qty available');
    if (notFoundError) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (stockError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Invalid online order data' : 'Failed to update online order',
      error: error.message,
    });
  }
};

const markOnlineOrderDelivered = async (req, res) => {
  try {
    const order = await OnlineOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Online order not found',
      });
    }

    order.status = 'delivered';
    await order.save();

    const populated = await populateOrder(OnlineOrder.findById(order._id));

    return res.status(200).json({
      success: true,
      message: 'Online order delivered successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message,
    });
  }
};

const completeOnlineOrderPayment = async (req, res) => {
  try {
    const order = await OnlineOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Online order not found',
      });
    }

    const paymentAmount = Number(req.body?.paymentAmount || 0);
    const paymentType = String(req.body?.paymentType || 'online').trim().toLowerCase() || 'online';

    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'paymentAmount must be greater than 0',
      });
    }

    order.paymentReceived = true;
    order.paymentAmount = paymentAmount;
    order.paymentType = paymentType;
    order.paymentReceivedAt = new Date();
    await order.save();

    const populated = await populateOrder(OnlineOrder.findById(order._id));

    return res.status(200).json({
      success: true,
      message: 'Online order payment completed successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message,
    });
  }
};

const deleteOnlineOrder = async (req, res) => {
  try {
    const deleted = await OnlineOrder.findById(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Online order not found',
      });
    }

    const restoreMap = new Map();
    (deleted.items || []).forEach((item) => {
      const productId = String(item.productId || '');
      restoreMap.set(productId, Number(restoreMap.get(productId) || 0) + Number(item.quantity || 0));
    });
    await updateProductStocks(restoreMap);
    await OnlineOrder.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Online order deleted successfully',
      data: deleted,
    });
  } catch (error) {
    const stockError = error?.message?.includes('qty available');
    if (stockError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to delete online order',
      error: error.message,
    });
  }
};

module.exports = {
  getAllOnlineOrders,
  getOnlineOrderById,
  createOnlineOrder,
  updateOnlineOrder,
  markOnlineOrderDelivered,
  completeOnlineOrderPayment,
  deleteOnlineOrder,
};
