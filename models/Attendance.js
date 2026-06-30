const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'User is required'],
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      trim: true,
      index: true,
    },
    inTime: {
      type: Date,
      required: [true, 'In time is required'],
    },
    outTime: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);