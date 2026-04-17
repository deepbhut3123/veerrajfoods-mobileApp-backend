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
  createShop,
  updateShop,
  deleteShop,
  getMyShops,
  getShopRoutes,
  getAllShops,
} = require('../controllers/shopController');
const {
  getAllUsers,
  updateUserActiveStatus,
} = require('../controllers/userAdminController');

const router = express.Router();

router.use(protect);

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

router.post('/routes', requireAdmin, createRoute);
router.get('/routes', requireAdmin, getAllRoutes);
router.get('/routes/:id', requireAdmin, getRouteById);
router.put('/routes/:id', requireAdmin, updateRoute);
router.delete('/routes/:id', requireAdmin, deleteRoute);

router.get('/shops/routes', getShopRoutes);
router.post('/shops', parseShopImageUpload, createShop);
router.get('/shops/my-shops', getMyShops);
router.put('/shops/:id', parseShopImageUpload, updateShop);
router.delete('/shops/:id', deleteShop);
router.get('/shops', requireAdmin, getAllShops);

router.get('/users', requireAdmin, getAllUsers);
router.patch('/users/:id/status', requireAdmin, updateUserActiveStatus);

module.exports = router;
