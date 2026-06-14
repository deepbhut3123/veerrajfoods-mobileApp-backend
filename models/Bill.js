const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema(
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
    productRate: {
      type: Number,
      required: [true, 'productRate is required'],
      min: [0, 'productRate must be greater than or equal to 0'],
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

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: [true, 'routeId is required'],
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'shopId is required'],
    },
    items: {
      type: [billItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one bill item is required',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required'],
      min: [0, 'totalAmount must be greater than or equal to 0'],
    },
    status: {
      type: String,
      enum: ['ordered', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'ordered',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Bill', billSchema);
