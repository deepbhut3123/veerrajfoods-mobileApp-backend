const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: [true, 'productName is required'],
      trim: true,
    },
    qtyKg: {
      type: Number,
      required: [true, 'qtyKg is required'],
      min: [0, 'qtyKg must be greater than or equal to 0'],
    },
    rate: {
      type: Number,
      required: [true, 'rate is required'],
      min: [0, 'rate must be greater than or equal to 0'],
    },
    tax: {
      type: Number,
      required: [true, 'tax is required'],
      min: [0, 'tax must be greater than or equal to 0'],
    },
    taxAmount: {
      type: Number,
      required: [true, 'taxAmount is required'],
      min: [0, 'taxAmount must be greater than or equal to 0'],
    },
    transport: {
      type: Number,
      required: [true, 'transport is required'],
      min: [0, 'transport must be greater than or equal to 0'],
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

const purchaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    purchaseDate: {
      type: String,
      required: [true, 'purchaseDate is required'],
      trim: true,
      index: true,
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'At least one purchase item is required',
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

module.exports = mongoose.model('Purchase', purchaseSchema);
