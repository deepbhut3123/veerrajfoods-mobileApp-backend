const mongoose = require('mongoose');

const dealerPaymentSchema = new mongoose.Schema(
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
      index: true,
    },
    paymentDate: {
      type: Date,
      required: [true, 'paymentDate is required'],
    },
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0.01, 'amount must be greater than 0'],
    },
    paymentType: {
      type: String,
      required: [true, 'paymentType is required'],
      enum: {
        values: ['cash', 'online', 'bank'],
        message: 'paymentType must be cash, online or bank',
      },
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('DealerPayment', dealerPaymentSchema);
