const mongoose = require('mongoose');

const onlineCustomerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be at least 2 characters'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'phoneNumber is required'],
      trim: true,
      match: [/^\d{10}$/, 'phoneNumber must be exactly 10 digits'],
    },
    address: {
      type: String,
      required: [true, 'address is required'],
      trim: true,
      minlength: [5, 'address must be at least 5 characters'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('OnlineCustomer', onlineCustomerSchema);
