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
  markDealerBillsAsShipped,
} = require('../controllers/dealerBillController');
const {
  createDealerPayment,
  getAllDealerPayments,
  updateDealerPayment,
  deleteDealerPayment,
} = require('../controllers/dealerPaymentController');

const router = express.Router();
const allowDealerBillAccess = requireAnyRole(1, 3, 5);

router.use(protect);

router.get('/dealers', allowDealerBillAccess, getAllDealers);
router.post('/dealers', requireAdmin, createDealer);
router.put('/dealers/:id', requireAdmin, updateDealer);
router.delete('/dealers/:id', requireAdmin, deleteDealer);

router.get('/products', allowDealerBillAccess, getAllDealerProducts);
router.post('/products', requireAdmin, createDealerProduct);
router.patch('/products/reorder', requireAdmin, reorderDealerProducts);
router.put('/products/:id', requireAdmin, updateDealerProduct);
router.delete('/products/:id', requireAdmin, deleteDealerProduct);

router.get('/bills', allowDealerBillAccess, getAllDealerBills);
router.post('/bills', allowDealerBillAccess, createDealerBill);
router.patch('/bills/ship', requireAdmin, markDealerBillsAsShipped);
router.put('/bills/:id', allowDealerBillAccess, updateDealerBill);
router.delete('/bills/:id', requireAdmin, deleteDealerBill);

router.get('/payments', requireAdmin, getAllDealerPayments);
router.post('/payments', requireAdmin, createDealerPayment);
router.put('/payments/:id', requireAdmin, updateDealerPayment);
router.delete('/payments/:id', requireAdmin, deleteDealerPayment);

module.exports = router;
