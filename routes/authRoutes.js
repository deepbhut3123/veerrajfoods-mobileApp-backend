const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  register,
  login,
  verifyLoginCode,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  logout,
} = require('../controllers/authController');
const {
  getMyAttendance,
  markMyAttendanceCheckIn,
  markMyAttendanceCheckOut,
  markMyAttendanceBreakIn,
  markMyAttendanceBreakOut,
} = require('../controllers/attendanceController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-login', verifyLoginCode);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/attendance', protect, getMyAttendance);
router.post('/attendance/check-in', protect, markMyAttendanceCheckIn);
router.post('/attendance/check-out', protect, markMyAttendanceCheckOut);
router.post('/attendance/break-in', protect, markMyAttendanceBreakIn);
router.post('/attendance/break-out', protect, markMyAttendanceBreakOut);
router.post('/logout', protect, logout);

module.exports = router;
