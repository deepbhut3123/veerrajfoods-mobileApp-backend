const express = require('express');
const {
  register,
  login,
  verifyLoginCode,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-login', verifyLoginCode);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
