const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    dealerName: {
      type: String,
      required: [true, 'dealerName is required'],
      trim: true,
      minlength: [2, 'dealerName must be at least 2 characters'],
    },
    contactNo: {
      type: String,
      required: [true, 'contactNo is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'city is required'],
      trim: true,
    },
    margin: {
      type: Number,
      required: [true, 'margin is required'],
      min: [0, 'margin must be greater than or equal to 0'],
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Dealer', dealerSchema);
