const express = require('express');
const { protect, requireAdmin } = require('../middlewares/authMiddleware');
const {
  createRoute,
  getAllRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
} = require('../controllers/routeController');
const { getAllShops } = require('../controllers/shopController');

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

router.get('/shops', requireAdmin, getAllShops);

module.exports = router;
