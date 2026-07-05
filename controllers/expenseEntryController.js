const ExpenseEntry = require('../models/ExpenseEntry');

const normalizeNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return NaN;
  }

  return Number(value);
};

const buildExpenseEntryPayload = ({ expenseDate, expenseType, reason, paymentType, amount, userId }) => {
  const normalizedDate = String(expenseDate || '').trim();
  const normalizedExpenseType = String(expenseType || '').trim().toLowerCase();
  const normalizedReason = String(reason || '').trim();
  const normalizedPaymentType = String(paymentType || '').trim().toLowerCase();
  const parsedAmount = normalizeNumber(amount);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return {
      error: {
        status: 400,
        message: 'expenseDate must be in YYYY-MM-DD format',
      },
    };
  }

  if (!normalizedExpenseType) {
    return {
      error: {
        status: 400,
        message: 'expenseType is required',
      },
    };
  }

  if (normalizedExpenseType === 'other' && !normalizedReason) {
    return {
      error: {
        status: 400,
        message: 'reason is required when expense type is other',
      },
    };
  }

  if (!['cash', 'online', 'bank'].includes(normalizedPaymentType)) {
    return {
      error: {
        status: 400,
        message: 'paymentType must be cash, online or bank',
      },
    };
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return {
      error: {
        status: 400,
        message: 'amount must be a valid number',
      },
    };
  }

  return {
    payload: {
      userId,
      expenseDate: normalizedDate,
      expenseType: normalizedExpenseType,
      reason: normalizedExpenseType === 'other' ? normalizedReason : '',
      paymentType: normalizedPaymentType,
      amount: parsedAmount,
    },
  };
};

const populateExpenseEntry = (query) => query.populate('userId', 'name email roleId');

const buildExpenseSearchValue = (entry) =>
  [
    entry?._id,
    entry?.expenseDate,
    entry?.expenseType,
    entry?.reason,
    entry?.paymentType,
    entry?.amount,
    entry?.userId?._id,
    entry?.userId?.name,
    entry?.userId?.email,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ')
    .toLowerCase();

const createExpenseEntry = async (req, res) => {
  try {
    const prepared = buildExpenseEntryPayload({
      expenseDate: req.body?.expenseDate,
      expenseType: req.body?.expenseType,
      reason: req.body?.reason,
      paymentType: req.body?.paymentType,
      amount: req.body?.amount,
      userId: req.user._id,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const created = await ExpenseEntry.create(prepared.payload);
    const populated = await populateExpenseEntry(ExpenseEntry.findById(created._id));

    return res.status(201).json({
      success: true,
      message: 'Expense entry created successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create expense entry',
      error: error.message,
    });
  }
};

const getAllExpenseEntries = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim().toLowerCase();
    const expenseType = String(req.query?.expenseType || '').trim().toLowerCase();
    const query = {};

    if (expenseType) {
      query.expenseType = expenseType;
    }

    const entries = await populateExpenseEntry(
      ExpenseEntry.find(query).sort({ expenseDate: -1, createdAt: -1 })
    );

    const filteredEntries = search
      ? entries.filter((entry) => buildExpenseSearchValue(entry).includes(search))
      : entries;

    return res.status(200).json({
      success: true,
      message: 'Expense entries fetched successfully',
      data: filteredEntries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch expense entries',
      error: error.message,
    });
  }
};

const getExpenseEntryById = async (req, res) => {
  try {
    const entry = await populateExpenseEntry(ExpenseEntry.findById(req.params.id));

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Expense entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Expense entry fetched successfully',
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch expense entry',
      error: error.message,
    });
  }
};

const updateExpenseEntry = async (req, res) => {
  try {
    const existingEntry = await ExpenseEntry.findById(req.params.id);

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: 'Expense entry not found',
      });
    }

    const prepared = buildExpenseEntryPayload({
      expenseDate: req.body?.expenseDate,
      expenseType: req.body?.expenseType,
      reason: req.body?.reason,
      paymentType: req.body?.paymentType,
      amount: req.body?.amount,
      userId: existingEntry.userId,
    });

    if (prepared.error) {
      return res.status(prepared.error.status).json({
        success: false,
        message: prepared.error.message,
      });
    }

    const updated = await ExpenseEntry.findByIdAndUpdate(req.params.id, prepared.payload, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('userId', 'name email roleId');

    return res.status(200).json({
      success: true,
      message: 'Expense entry updated successfully',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update expense entry',
      error: error.message,
    });
  }
};

const deleteExpenseEntry = async (req, res) => {
  try {
    const deleted = await ExpenseEntry.findByIdAndDelete(req.params.id).populate(
      'userId',
      'name email roleId'
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Expense entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Expense entry deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete expense entry',
      error: error.message,
    });
  }
};

module.exports = {
  createExpenseEntry,
  getAllExpenseEntries,
  getExpenseEntryById,
  updateExpenseEntry,
  deleteExpenseEntry,
};

