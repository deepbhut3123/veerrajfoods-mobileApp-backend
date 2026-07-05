const mongoose = require('mongoose');

const purchaseProductSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    productName: {
      type: String,
      required: [true, 'productName is required'],
      trim: true,
      minlength: [2, 'productName must be at least 2 characters'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

purchaseProductSchema.index(
  { productName: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = mongoose.model('PurchaseProduct', purchaseProductSchema);
