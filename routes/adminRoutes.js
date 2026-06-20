const express = require('express');
const { protect, requireAdmin } = require('../middlewares/authMiddleware');
const {
  getAdminDashboardSummary,
} = require('../controllers/dashboardController');
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserActiveStatus,
} = require('../controllers/userAdminController');

const router = express.Router();

router.use(protect);

router.get('/dashboard/summary', requireAdmin, getAdminDashboardSummary);
router.get('/profile', (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      roleId: req.user.roleId,
    },
  });
});

router.get('/users', requireAdmin, getAllUsers);
router.post('/users', requireAdmin, createUser);
router.put('/users/:id', requireAdmin, updateUser);
router.delete('/users/:id', requireAdmin, deleteUser);
router.patch('/users/:id/status', requireAdmin, updateUserActiveStatus);

module.exports = router;
