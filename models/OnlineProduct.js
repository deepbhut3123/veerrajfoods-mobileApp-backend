const mongoose = require('mongoose');

const onlineProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be at least 2 characters'],
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
    currentStock: {
      type: Number,
      default: 0,
      min: [0, 'currentStock cannot be negative'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('OnlineProduct', onlineProductSchema);
