const mongoose = require('mongoose');

const dealerBillItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DealerProduct',
      default: null,
    },
    mrp: {
      type: Number,
      required: [true, 'mrp is required'],
      min: [0, 'mrp must be greater than or equal to 0'],
    },
    productName: {
      type: String,
      required: [true, 'productName is required'],
      trim: true,
    },
    productRate: {
      type: Number,
      required: [true, 'productRate is required'],
      min: [0, 'productRate must be greater than or equal to 0'],
    },
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0, 'amount must be greater than or equal to 0'],
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
    },
    total: {
      type: Number,
      required: [true, 'total is required'],
      min: [0, 'total must be greater than or equal to 0'],
    },
  },
  {
    _id: false,
  }
);

const dealerBillSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dealer',
      required: [true, 'dealerId is required'],
    },
    billDate: {
      type: Date,
      required: [true, 'billDate is required'],
    },
    items: {
      type: [dealerBillItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one bill item is required',
      },
    },
    kattaCount: {
      type: Number,
      required: [true, 'kattaCount is required'],
      min: [0, 'kattaCount must be greater than or equal to 0'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required'],
      min: [0, 'totalAmount must be greater than or equal to 0'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('DealerBill', dealerBillSchema);
