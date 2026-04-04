const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { uploadShopImage } = require('../middlewares/uploadMiddleware');
const {
  createShop,
  updateShop,
  deleteShop,
  getMyShops,
  getShopRoutes,
} = require('../controllers/shopController');

const router = express.Router();

router.use(protect);

router.get('/routes', getShopRoutes);
router.post('/', uploadShopImage.single('image'), createShop);
router.get('/my-shops', getMyShops);
router.put('/:id', uploadShopImage.single('image'), updateShop);
router.delete('/:id', deleteShop);

module.exports = router;
