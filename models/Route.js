const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
  {
    routeName: {
      type: String,
      required: [true, 'routeName is required'],
      trim: true,
      minlength: [2, 'routeName must be at least 2 characters'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Route', routeSchema);
