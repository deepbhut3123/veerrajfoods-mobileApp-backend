const User = require('../models/User');

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
  updateUserActiveStatus,
};
