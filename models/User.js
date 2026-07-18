const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator(value) {
          return !value || /^\S+@\S+\.\S+$/.test(value);
        },
        message: 'Please provide a valid email',
      },
    },
    mobileNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    roleId: {
      type: Number,
      default: 2,
      required: true,
    },
    salary: {
      type: Number,
      default: null,
      min: [0, 'Salary cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
    resetPasswordOtp: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordOtpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    loginVerificationCode: {
      type: String,
      default: null,
      select: false,
    },
    loginVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },
    authenticatorSecret: {
      type: String,
      default: null,
      select: false,
    },
    authenticatorEnabled: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('Users', userSchema);



