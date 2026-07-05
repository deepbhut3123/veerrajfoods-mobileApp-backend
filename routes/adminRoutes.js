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
const {
  getAdminAttendance,
  updateAdminAttendance,
} = require('../controllers/attendanceController');
const {
  createStockEntry,
  getAllStockEntries,
  getStockEntryById,
  updateStockEntry,
  deleteStockEntry,
} = require('../controllers/stockEntryController');
const {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
} = require('../controllers/purchaseController');
const {
  createExpenseEntry,
  getAllExpenseEntries,
  getExpenseEntryById,
  updateExpenseEntry,
  deleteExpenseEntry,
} = require('../controllers/expenseEntryController');

const router = express.Router();

router.use(protect);

router.get('/dashboard/summary', requireAdmin, getAdminDashboardSummary);
router.get('/attendance', requireAdmin, getAdminAttendance);
router.put('/attendance/:id', requireAdmin, updateAdminAttendance);
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
router.get('/retailer/stocks', requireAdmin, getAllStockEntries);
router.get('/retailer/stocks/:id', requireAdmin, getStockEntryById);
router.post('/retailer/stocks', requireAdmin, createStockEntry);
router.put('/retailer/stocks/:id', requireAdmin, updateStockEntry);
router.delete('/retailer/stocks/:id', requireAdmin, deleteStockEntry);
router.get('/expenses/purchases', requireAdmin, getAllPurchases);
router.get('/expenses/purchases/:id', requireAdmin, getPurchaseById);
router.post('/expenses/purchases', requireAdmin, createPurchase);
router.put('/expenses/purchases/:id', requireAdmin, updatePurchase);
router.delete('/expenses/purchases/:id', requireAdmin, deletePurchase);
router.get('/expenses/entries', requireAdmin, getAllExpenseEntries);
router.get('/expenses/entries/:id', requireAdmin, getExpenseEntryById);
router.post('/expenses/entries', requireAdmin, createExpenseEntry);
router.put('/expenses/entries/:id', requireAdmin, updateExpenseEntry);
router.delete('/expenses/entries/:id', requireAdmin, deleteExpenseEntry);

module.exports = router;
