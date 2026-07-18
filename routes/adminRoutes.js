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
  deleteAdminAttendance,
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
  createPurchaseProduct,
  getAllPurchaseProducts,
} = require('../controllers/purchaseProductController');
const {
  createExpenseEntry,
  getAllExpenseEntries,
  getExpenseEntryById,
  updateExpenseEntry,
  deleteExpenseEntry,
} = require('../controllers/expenseEntryController');
const {
  getAllOnlineCustomers,
  getOnlineCustomerById,
  createOnlineCustomer,
  updateOnlineCustomer,
  deleteOnlineCustomer,
} = require('../controllers/onlineCustomerController');
const {
  getAllOnlineProducts,
  getOnlineProductById,
  createOnlineProduct,
  updateOnlineProduct,
  deleteOnlineProduct,
} = require('../controllers/onlineProductController');
const {
  getAllOnlineStockEntries,
  getOnlineStockEntryById,
  createOnlineStockEntry,
  updateOnlineStockEntry,
  deleteOnlineStockEntry,
} = require('../controllers/onlineStockEntryController');
const {
  getAllOnlineOrders,
  getOnlineOrderById,
  createOnlineOrder,
  updateOnlineOrder,
  markOnlineOrderDelivered,
  completeOnlineOrderPayment,
  deleteOnlineOrder,
} = require('../controllers/onlineOrderController');

const router = express.Router();

router.use(protect);

router.get('/dashboard/summary', requireAdmin, getAdminDashboardSummary);
router.get('/attendance', requireAdmin, getAdminAttendance);
router.put('/attendance/:id', requireAdmin, updateAdminAttendance);
router.delete('/attendance/:id', requireAdmin, deleteAdminAttendance);
router.get('/profile', (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email || '',
      mobileNumber: req.user.mobileNumber || '',
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
router.get('/expenses/purchase-products', requireAdmin, getAllPurchaseProducts);
router.post('/expenses/purchase-products', requireAdmin, createPurchaseProduct);
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
router.get('/online/customers', requireAdmin, getAllOnlineCustomers);
router.get('/online/customers/:id', requireAdmin, getOnlineCustomerById);
router.post('/online/customers', requireAdmin, createOnlineCustomer);
router.put('/online/customers/:id', requireAdmin, updateOnlineCustomer);
router.delete('/online/customers/:id', requireAdmin, deleteOnlineCustomer);
router.get('/online/products', requireAdmin, getAllOnlineProducts);
router.get('/online/products/:id', requireAdmin, getOnlineProductById);
router.post('/online/products', requireAdmin, createOnlineProduct);
router.put('/online/products/:id', requireAdmin, updateOnlineProduct);
router.delete('/online/products/:id', requireAdmin, deleteOnlineProduct);
router.get('/online/stocks', requireAdmin, getAllOnlineStockEntries);
router.get('/online/stocks/:id', requireAdmin, getOnlineStockEntryById);
router.post('/online/stocks', requireAdmin, createOnlineStockEntry);
router.put('/online/stocks/:id', requireAdmin, updateOnlineStockEntry);
router.delete('/online/stocks/:id', requireAdmin, deleteOnlineStockEntry);
router.get('/online/orders', requireAdmin, getAllOnlineOrders);
router.get('/online/orders/:id', requireAdmin, getOnlineOrderById);
router.post('/online/orders', requireAdmin, createOnlineOrder);
router.put('/online/orders/:id', requireAdmin, updateOnlineOrder);
router.patch('/online/orders/:id/delivery', requireAdmin, markOnlineOrderDelivered);
router.patch('/online/orders/:id/payment', requireAdmin, completeOnlineOrderPayment);
router.delete('/online/orders/:id', requireAdmin, deleteOnlineOrder);

module.exports = router;




