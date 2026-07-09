const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'userId is required'],
      index: true,
    },
    routeName: {
      type: String,
      required: [true, 'routeName is required'],
      trim: true,
      minlength: [2, 'routeName must be at least 2 characters'],
    },
    routeNameGujarati: {
      type: String,
      trim: true,
      default: '',
    },
    cityName: {
      type: String,
      required: [true, 'cityName is required'],
      trim: true,
      minlength: [2, 'cityName must be at least 2 characters'],
    },
    cityNameGujarati: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Route', routeSchema);
