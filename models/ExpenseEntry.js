const mongoose = require('mongoose');

const expenseEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    expenseDate: {
      type: String,
      required: [true, 'expenseDate is required'],
      trim: true,
      index: true,
    },
    expenseType: {
      type: String,
      required: [true, 'expenseType is required'],
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    paymentType: {
      type: String,
      enum: ['cash', 'online', 'bank'],
      required: [true, 'paymentType is required'],
    },
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0, 'amount must be greater than or equal to 0'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('ExpenseEntry', expenseEntrySchema);
