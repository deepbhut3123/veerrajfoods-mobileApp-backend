const bcrypt = require('bcryptjs');
const User = require('../models/User');

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  roleId: user.roleId,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getAllUsers = async (_req, res) => {
  try {
    const users = await User.find({})
      .select('name email roleId isActive createdAt updatedAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, roleId, isActive } = req.body;

    if (!name || !String(name).trim() || !email || !String(email).trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'name, email and password are required',
      });
    }

    const parsedRoleId = Number(roleId ?? 2);
    if (![1, 2].includes(parsedRoleId)) {
      return res.status(400).json({
        success: false,
        message: 'roleId must be 1 or 2',
      });
    }

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be true or false',
      });
    }

    const existingUser = await User.findOne({ email: String(email).toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashedPassword,
      roleId: parsedRoleId,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, password, roleId, isActive } = req.body;
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (String(targetUser._id) === String(req.user._id) && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: 'name cannot be empty',
        });
      }
      targetUser.name = String(name).trim();
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: 'email cannot be empty',
        });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: targetUser._id },
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email is already registered',
        });
      }
      targetUser.email = normalizedEmail;
    }

    if (password !== undefined && String(password).trim()) {
      targetUser.password = await bcrypt.hash(password, 10);
    }

    if (roleId !== undefined) {
      const parsedRoleId = Number(roleId);
      if (![1, 2].includes(parsedRoleId)) {
        return res.status(400).json({
          success: false,
          message: 'roleId must be 1 or 2',
        });
      }
      targetUser.roleId = parsedRoleId;
    }

    if (typeof isActive === 'boolean') {
      targetUser.isActive = isActive;
    }

    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: sanitizeUser(targetUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: sanitizeUser(deleted),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
};

const updateUserActiveStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be true or false',
      });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (String(targetUser._id) === String(req.user._id) && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        roleId: targetUser.roleId,
        isActive: targetUser.isActive,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserActiveStatus,
};
