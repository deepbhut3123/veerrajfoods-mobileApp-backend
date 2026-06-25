const express = require('express');
const { protect, requireAdmin } = require('../middlewares/authMiddleware');
const { parseShopImageUpload } = require('../middlewares/uploadMiddleware');
const {
  createRoute,
  getAllRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
} = require('../controllers/routeController');
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  reorderProducts,
  deleteProduct,
} = require('../controllers/productController');
const {
  createShop,
  updateShop,
  deleteShop,
  getMyShops,
  getShopRoutes,
  getAllShops,
} = require('../controllers/shopController');
const {
  createBill,
  deleteBill,
  bulkDeleteBills,
  getAllAdminBills,
  getMyBills,
  getBillProducts,
  markBillsAsShipped,
  markBillsAsCompleted,
  updateBill,
} = require('../controllers/billController');
const {
  getAllAdminRoutes,
} = require('../controllers/dashboardController');

const router = express.Router();

router.use(protect);

router.get('/routes/all', requireAdmin, getAllAdminRoutes);
router.post('/routes', createRoute);
router.get('/routes', getAllRoutes);
router.get('/routes/:id', getRouteById);
router.put('/routes/:id', updateRoute);
router.delete('/routes/:id', deleteRoute);

router.post('/products', requireAdmin, createProduct);
router.get('/products', requireAdmin, getAllProducts);
router.get('/products/catalog', getBillProducts);
router.get('/products/:id', requireAdmin, getProductById);
router.put('/products/:id', requireAdmin, updateProduct);
router.patch('/products/reorder', requireAdmin, reorderProducts);
router.delete('/products/:id', requireAdmin, deleteProduct);

router.get('/shops/routes', getShopRoutes);
router.post('/shops', parseShopImageUpload, createShop);
router.get('/shops/my-shops', getMyShops);
router.put('/shops/:id', parseShopImageUpload, updateShop);
router.delete('/shops/:id', deleteShop);
router.get('/shops', requireAdmin, getAllShops);

router.get('/bills/my-bills', getMyBills);
router.get('/bills/all', requireAdmin, getAllAdminBills);
router.patch('/bills/ship', requireAdmin, markBillsAsShipped);
router.patch('/bills/complete', requireAdmin, markBillsAsCompleted);
router.post('/bills', createBill);
router.put('/bills/:id', updateBill);
router.delete('/bills/:id', deleteBill);
router.delete('/bills', bulkDeleteBills);

module.exports = router;






