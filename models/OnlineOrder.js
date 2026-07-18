const mongoose = require('mongoose');

const onlineOrderItemSchema = new mongoose.Schema(
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
      min: [1, 'quantity must be at least 1'],
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

const onlineOrderSchema = new mongoose.Schema(
  {
    orderDate: {
      type: String,
      required: [true, 'orderDate is required'],
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnlineCustomer',
      required: [true, 'customerId is required'],
    },
    customerName: {
      type: String,
      required: [true, 'customerName is required'],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'phoneNumber is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'address is required'],
      trim: true,
    },
    status: {
      type: String,
      trim: true,
      default: 'ordered',
    },
    paymentReceived: {
      type: Boolean,
      default: false,
    },
    paymentAmount: {
      type: Number,
      min: [0, 'paymentAmount cannot be negative'],
      default: 0,
    },
    paymentType: {
      type: String,
      trim: true,
      default: 'online',
    },
    paymentReceivedAt: {
      type: Date,
      default: null,
    },
    items: {
      type: [onlineOrderItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one order item is required',
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

module.exports = mongoose.model('OnlineOrder', onlineOrderSchema);
