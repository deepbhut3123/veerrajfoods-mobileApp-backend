const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationCodeToAdmin } = require('../config/mail');

const LOGIN_VERIFICATION_EXPIRES_MS = 10 * 60 * 1000;

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const signVerificationToken = (userId) =>
  jwt.sign({ id: userId, purpose: 'login-verification' }, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  roleId: user.roleId,
  isActive: user.isActive !== false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const generateVerificationCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const register = async (req, res) => {
  try {
    const { name, email, password, roleId, roleid } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    const parsedRoleId = Number(roleId ?? roleid ?? 2);
    if (![1, 2].includes(parsedRoleId)) {
      return res.status(400).json({
        success: false,
        message: 'roleId must be 1 (admin) or 2 (other)',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      roleId: parsedRoleId,
      isActive: true,
    });

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.roleId === 1) {
      const token = signToken(user._id);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: sanitizeUser(user),
      });
    }

    const verificationCode = generateVerificationCode();
    const verificationCodeHash = crypto
      .createHash('sha256')
      .update(verificationCode)
      .digest('hex');
    const verificationExpiresAt = new Date(Date.now() + LOGIN_VERIFICATION_EXPIRES_MS);

    user.loginVerificationCode = verificationCodeHash;
    user.loginVerificationExpires = verificationExpiresAt;
    await user.save();

    const emailResult = await sendVerificationCodeToAdmin({
      user,
      code: verificationCode,
    });
    const verificationToken = signVerificationToken(user._id);

    return res.status(202).json({
      success: true,
      message: emailResult.delivered
        ? 'Verification code sent to admin email'
        : 'Verification code generated. Configure SMTP to send it by email.',
      requiresVerification: true,
      verificationToken,
      adminEmail: emailResult.adminEmail,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message,
    });
  }
};

const verifyLoginCode = async (req, res) => {
  try {
    const { verificationToken, code } = req.body;

    if (!verificationToken || !code) {
      return res.status(400).json({
        success: false,
        message: 'verificationToken and code are required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
    } catch (_error) {
      return res.status(401).json({
        success: false,
        message: 'Verification session expired. Please login again.',
      });
    }

    if (!decoded || decoded.purpose !== 'login-verification' || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification session. Please login again.',
      });
    }

    const user = await User.findById(decoded.id).select(
      '+loginVerificationCode +loginVerificationExpires',
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.',
      });
    }

    if (user.roleId === 1) {
      return res.status(400).json({
        success: false,
        message: 'Admin login does not require verification code',
      });
    }

    if (!user.loginVerificationCode || !user.loginVerificationExpires) {
      return res.status(400).json({
        success: false,
        message: 'No verification code is pending for this account',
      });
    }

    if (user.loginVerificationExpires.getTime() < Date.now()) {
      user.loginVerificationCode = null;
      user.loginVerificationExpires = null;
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'Verification code expired. Please login again.',
      });
    }

    const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    if (codeHash !== user.loginVerificationCode) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    user.loginVerificationCode = null;
    user.loginVerificationExpires = null;
    await user.save();

    const token = signToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify login code',
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset token generated',
      resetToken,
      note: 'Use this token in /api/auth/reset-password within 15 minutes',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request',
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and newPassword are required',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+password +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  verifyLoginCode,
  forgotPassword,
  resetPassword,
};
