const express = require('express');
const {
  register,
  login,
  verifyLoginCode,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-login', verifyLoginCode);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
