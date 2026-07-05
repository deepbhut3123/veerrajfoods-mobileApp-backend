const mongoose = require('mongoose');

const stockEntryItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required'],
    },
    productName: {
      type: String,
      required: [true, 'productName is required'],
      trim: true,
    },
    mrp: {
      type: Number,
      required: [true, 'mrp is required'],
      min: [0, 'mrp must be greater than or equal to 0'],
    },
    productRate: {
      type: Number,
      required: [true, 'productRate is required'],
      min: [0, 'productRate must be greater than or equal to 0'],
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [0, 'quantity must be greater than or equal to 0'],
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

const stockEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    entryDate: {
      type: String,
      required: [true, 'entryDate is required'],
      trim: true,
      index: true,
    },
    items: {
      type: [stockEntryItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one stock item is required',
      },
      default: [],
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

module.exports = mongoose.model('StockEntry', stockEntrySchema);
