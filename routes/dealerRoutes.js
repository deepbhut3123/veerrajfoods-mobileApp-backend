const express = require('express');
const { protect, requireAdmin } = require('../middlewares/authMiddleware');
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

router.use(protect);
router.use(requireAdmin);

router.get('/dealers', getAllDealers);
router.post('/dealers', createDealer);
router.put('/dealers/:id', updateDealer);
router.delete('/dealers/:id', deleteDealer);

router.get('/products', getAllDealerProducts);
router.post('/products', createDealerProduct);
router.patch('/products/reorder', reorderDealerProducts);
router.put('/products/:id', updateDealerProduct);
router.delete('/products/:id', deleteDealerProduct);

router.get('/bills', getAllDealerBills);
router.post('/bills', createDealerBill);
router.put('/bills/:id', updateDealerBill);
router.delete('/bills/:id', deleteDealerBill);

router.get('/payments', getAllDealerPayments);
router.post('/payments', createDealerPayment);
router.put('/payments/:id', updateDealerPayment);
router.delete('/payments/:id', deleteDealerPayment);

module.exports = router;
