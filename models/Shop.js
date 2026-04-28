const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: [true, 'routeId is required'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
    },
    shopName: {
      type: String,
      required: [true, 'shopName is required'],
      trim: true,
      minlength: [2, 'shopName must be at least 2 characters'],
    },
    shopAddress: {
      type: String,
      required: [true, 'shopAddress is required'],
      trim: true,
      minlength: [5, 'shopAddress must be at least 5 characters'],
    },
    mobileNumber: {
      type: String,
      required: [true, 'mobileNumber is required'],
      trim: true,
      match: [/^\d{10}$/, 'mobileNumber must be exactly 10 digits'],
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    shopImage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Shop', shopSchema);
