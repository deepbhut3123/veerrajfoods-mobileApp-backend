const AccountDeletionRequest = require('../models/AccountDeletionRequest');

const getUserSnapshot = (user) => ({
  userId: user._id,
  name: user.name || 'User',
  email: user.email || '',
  mobileNumber: user.mobileNumber || '',
  roleId: Number(user.roleId || 0),
});

const createAccountDeletionRequest = async (req, res) => {
  try {
    const existingRequest = await AccountDeletionRequest.findOne({
      userId: req.user._id,
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: 'Your account deletion request is already pending.',
        data: existingRequest,
      });
    }

    const request = await AccountDeletionRequest.create(getUserSnapshot(req.user));

    return res.status(201).json({
      success: true,
      message: 'Your account deletion request has been sent to admin.',
      data: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create account deletion request',
      error: error.message,
    });
  }
};

const getAccountDeletionRequests = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      const pattern = new RegExp(String(search).trim(), 'i');
      query.$or = [{ name: pattern }, { email: pattern }, { mobileNumber: pattern }];
    }

    const requests = await AccountDeletionRequest.find(query)
      .populate('userId', 'name email mobileNumber roleId isActive')
      .populate('reviewedBy', 'name email')
      .sort({ requestedAt: -1 });

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load account deletion requests',
      error: error.message,
    });
  }
};

const updateAccountDeletionRequest = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const allowedStatuses = ['pending', 'approved', 'rejected', 'completed'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request status',
      });
    }

    const request = await AccountDeletionRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminNote: adminNote || '',
        reviewedAt: status === 'pending' ? null : new Date(),
        reviewedBy: status === 'pending' ? null : req.user._id,
      },
      { new: true },
    )
      .populate('userId', 'name email mobileNumber roleId isActive')
      .populate('reviewedBy', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Account deletion request not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Account deletion request updated successfully',
      data: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update account deletion request',
      error: error.message,
    });
  }
};

module.exports = {
  createAccountDeletionRequest,
  getAccountDeletionRequests,
  updateAccountDeletionRequest,
};
