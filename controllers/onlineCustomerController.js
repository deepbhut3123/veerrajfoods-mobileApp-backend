const OnlineCustomer = require('../models/OnlineCustomer');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCustomerPayload = (payload = {}) => ({
  name: String(payload.name || '').trim(),
  phoneNumber: String(payload.phoneNumber || '').trim(),
  address: String(payload.address || '').trim(),
});

const getAllOnlineCustomers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { name: regex },
        { phoneNumber: regex },
        { address: regex },
      ];
    }

    const customers = await OnlineCustomer.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Online customers fetched successfully',
      data: customers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online customers',
      error: error.message,
    });
  }
};

const getOnlineCustomerById = async (req, res) => {
  try {
    const customer = await OnlineCustomer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Online customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Online customer fetched successfully',
      data: customer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch online customer',
      error: error.message,
    });
  }
};

const createOnlineCustomer = async (req, res) => {
  try {
    const { name, phoneNumber, address } = normalizeCustomerPayload(req.body);

    if (!name || !phoneNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'name, phoneNumber and address are required',
      });
    }

    const customer = await OnlineCustomer.create({
      name,
      phoneNumber,
      address,
    });

    return res.status(201).json({
      success: true,
      message: 'Online customer created successfully',
      data: customer,
    });
  } catch (error) {
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Invalid online customer data' : 'Failed to create online customer',
      error: error.message,
    });
  }
};

const updateOnlineCustomer = async (req, res) => {
  try {
    const customer = await OnlineCustomer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Online customer not found',
      });
    }

    const { name, phoneNumber, address } = normalizeCustomerPayload(req.body);

    if (!name || !phoneNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'name, phoneNumber and address are required',
      });
    }

    customer.name = name;
    customer.phoneNumber = phoneNumber;
    customer.address = address;

    await customer.save();

    return res.status(200).json({
      success: true,
      message: 'Online customer updated successfully',
      data: customer,
    });
  } catch (error) {
    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Invalid online customer data' : 'Failed to update online customer',
      error: error.message,
    });
  }
};

const deleteOnlineCustomer = async (req, res) => {
  try {
    const customer = await OnlineCustomer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Online customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Online customer deleted successfully',
      data: customer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete online customer',
      error: error.message,
    });
  }
};

module.exports = {
  getAllOnlineCustomers,
  getOnlineCustomerById,
  createOnlineCustomer,
  updateOnlineCustomer,
  deleteOnlineCustomer,
};
