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
  deleteDealerProduct,
} = require('../controllers/dealerProductController');
const {
  createDealerBill,
  getAllDealerBills,
  updateDealerBill,
  deleteDealerBill,
} = require('../controllers/dealerBillController');

const router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get('/dealers', getAllDealers);
router.post('/dealers', createDealer);
router.put('/dealers/:id', updateDealer);
router.delete('/dealers/:id', deleteDealer);

router.get('/products', getAllDealerProducts);
router.post('/products', createDealerProduct);
router.put('/products/:id', updateDealerProduct);
router.delete('/products/:id', deleteDealerProduct);

router.get('/bills', getAllDealerBills);
router.post('/bills', createDealerBill);
router.put('/bills/:id', updateDealerBill);
router.delete('/bills/:id', deleteDealerBill);

module.exports = router;
