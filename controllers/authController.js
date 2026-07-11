const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendPasswordResetOtpEmail } = require('../config/mail');

const AUTHENTICATOR_ISSUER = process.env.AUTHENTICATOR_ISSUER || 'VRJ Mobile App';
const ADMIN_AUTHENTICATOR_SECRET = process.env.ADMIN_AUTHENTICATOR_SECRET || '';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const signToken = (userId) => {
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim();
  const jwtOptions = jwtExpiresIn ? { expiresIn: jwtExpiresIn } : undefined;

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, jwtOptions);
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

const isAdminUser = (user) => Number(user?.roleId) === 1;

const toBase32 = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

const fromBase32 = (input) => {
  const normalized = String(input).toUpperCase().replace(/=+$/g, '');
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 secret');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
};

const generateTotpToken = (secret, counter) => {
  const key = fromBase32(secret);
  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter % 0x100000000;

  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);

  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, '0');
};

const verifyTotpCode = (secret, token) => {
  const sanitizedToken = String(token).trim();
  if (!/^\d{6}$/.test(sanitizedToken)) {
    return false;
  }

  const currentCounter = Math.floor(Date.now() / 30000);

  for (let windowOffset = -1; windowOffset <= 1; windowOffset += 1) {
    if (generateTotpToken(secret, currentCounter + windowOffset) === sanitizedToken) {
      return true;
    }
  }

  return false;
};

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

    if (!isAdminUser(user)) {
      if (!ADMIN_AUTHENTICATOR_SECRET) {
        return res.status(500).json({
          success: false,
          message: 'ADMIN_AUTHENTICATOR_SECRET is not configured on the server',
        });
      }

      const verificationToken = signVerificationToken(user._id);

      return res.status(200).json({
        success: true,
        message: 'Enter the current Google Authenticator code to finish login.',
        requiresVerification: true,
        verificationToken,
        verificationMethod: 'authenticator',
        user: sanitizeUser(user),
      });
    }

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

    const user = await User.findById(decoded.id);

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

    if (isAdminUser(user)) {
      return res.status(400).json({
        success: false,
        message: 'Authenticator verification is not required for admin login.',
      });
    }

    if (!ADMIN_AUTHENTICATOR_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'ADMIN_AUTHENTICATOR_SECRET is not configured on the server',
      });
    }

    if (!verifyTotpCode(ADMIN_AUTHENTICATOR_SECRET, code)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google Authenticator code',
      });
    }

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

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+resetPasswordToken +resetPasswordExpires +resetPasswordOtp +resetPasswordOtpExpires',
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email',
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.resetPasswordOtp = otpHash;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendPasswordResetOtpEmail({
      user,
      otp,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to process forgot password request',
      error: error.message,
    });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select(
      '+resetPasswordToken +resetPasswordExpires +resetPasswordOtp +resetPasswordOtpExpires',
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email',
      });
    }

    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');

    if (
      !user.resetPasswordOtp ||
      !user.resetPasswordOtpExpires ||
      user.resetPasswordOtp !== otpHash ||
      user.resetPasswordOtpExpires <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      resetToken,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify reset OTP',
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
    }).select('+password +resetPasswordToken +resetPasswordExpires +resetPasswordOtp +resetPasswordOtpExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
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

const logout = async (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to logout',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  verifyLoginCode,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  logout,
};



