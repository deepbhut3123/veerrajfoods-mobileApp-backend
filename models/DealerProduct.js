const mongoose = require('mongoose');

const dealerProductSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
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
      minlength: [2, 'productName must be at least 2 characters'],
    },
    productRate: {
      type: Number,
      required: [true, 'productRate is required'],
      min: [0, 'productRate must be greater than or equal to 0'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('DealerProduct', dealerProductSchema);
