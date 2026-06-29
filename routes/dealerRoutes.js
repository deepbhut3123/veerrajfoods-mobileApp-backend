const express = require('express');
const { protect, requireAdmin, requireAnyRole } = require('../middlewares/authMiddleware');
const {
  createDealer,
  getAllDealers,
  updateDealer,
  deleteDealer,
} = require('../controllers/dealerController');
const {
  createDealerProduct,
  getAllDealerProducts,
  updateDealerProduct,
  reorderDealerProducts,
  deleteDealerProduct,
} = require('../controllers/dealerProductController');
const {
  createDealerBill,
  getAllDealerBills,
  updateDealerBill,
  deleteDealerBill,
} = require('../controllers/dealerBillController');
const {
  createDealerPayment,
  getAllDealerPayments,
  updateDealerPayment,
  deleteDealerPayment,
} = require('../controllers/dealerPaymentController');

const router = express.Router();
const allowAdminOrRoleFive = requireAnyRole(1, 5);

router.use(protect);

router.get('/dealers', allowAdminOrRoleFive, getAllDealers);
router.post('/dealers', requireAdmin, createDealer);
router.put('/dealers/:id', requireAdmin, updateDealer);
router.delete('/dealers/:id', requireAdmin, deleteDealer);

router.get('/products', allowAdminOrRoleFive, getAllDealerProducts);
router.post('/products', requireAdmin, createDealerProduct);
router.patch('/products/reorder', requireAdmin, reorderDealerProducts);
router.put('/products/:id', requireAdmin, updateDealerProduct);
router.delete('/products/:id', requireAdmin, deleteDealerProduct);

router.get('/bills', allowAdminOrRoleFive, getAllDealerBills);
router.post('/bills', allowAdminOrRoleFive, createDealerBill);
router.put('/bills/:id', requireAdmin, updateDealerBill);
router.delete('/bills/:id', requireAdmin, deleteDealerBill);

router.get('/payments', requireAdmin, getAllDealerPayments);
router.post('/payments', requireAdmin, createDealerPayment);
router.put('/payments/:id', requireAdmin, updateDealerPayment);
router.delete('/payments/:id', requireAdmin, deleteDealerPayment);

module.exports = router;
