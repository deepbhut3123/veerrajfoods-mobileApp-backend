const mongoose = require('mongoose');

const onlineStockEntryItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnlineProduct',
      required: [true, 'productId is required'],
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
    },
    weight: {
      type: String,
      required: [true, 'weight is required'],
      trim: true,
    },
    mrp: {
      type: Number,
      required: [true, 'mrp is required'],
      min: [0, 'mrp cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [0, 'quantity cannot be negative'],
    },
    total: {
      type: Number,
      required: [true, 'total is required'],
      min: [0, 'total cannot be negative'],
    },
  },
  {
    _id: false,
  }
);

const onlineStockEntrySchema = new mongoose.Schema(
  {
    entryDate: {
      type: String,
      required: [true, 'entryDate is required'],
      trim: true,
    },
    items: {
      type: [onlineStockEntryItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one stock item is required',
      },
      default: [],
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required'],
      min: [0, 'totalAmount cannot be negative'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('OnlineStockEntry', onlineStockEntrySchema);
