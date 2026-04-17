const Route = require('../models/Route');
const Shop = require('../models/Shop');
const { uploadBufferToCloudinary } = require('../middlewares/uploadMiddleware');

const getValidationMessage = (error, fallback) => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  if (error.name === 'ValidationError' && error.errors && typeof error.errors === 'object') {
    const firstError = Object.values(error.errors)[0];
    if (firstError && typeof firstError.message === 'string' && firstError.message.trim()) {
      return firstError.message;
    }
    return 'Validation failed';
  }

  return fallback;
};

const normalizeCoordinate = (value, min, max) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return NaN;
  }

  return parsed;
};

const canManageShop = (req, shop) => {
  if (!req.user || !shop) {
    return false;
  }
  if (req.user.roleId === 1) {
    return true;
  }
  return String(shop.userId) === String(req.user._id);
};

const getShopRoutes = async (_req, res) => {
  try {
    const routes = await Route.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      message: 'Routes fetched successfully',
      data: routes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch routes',
      error: error.message,
    });
  }
};

const createShop = async (req, res) => {
  try {
    const { routeId, shopName, shopAddress, imageUrl, latitude, longitude } = req.body;

    if (!routeId || !shopName || !shopAddress) {
      return res.status(400).json({
        success: false,
        message: 'routeId, shopName and shopAddress are required',
      });
    }

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    let finalImage = imageUrl && String(imageUrl).trim() ? String(imageUrl).trim() : '';
    if (req.file?.buffer) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      finalImage = uploaded.secure_url || uploaded.url || '';
    }

    const parsedLatitude = normalizeCoordinate(latitude, -90, 90);
    const parsedLongitude = normalizeCoordinate(longitude, -180, 180);
    const hasLocation = parsedLatitude !== null || parsedLongitude !== null;

    if (hasLocation && (parsedLatitude === null || parsedLongitude === null)) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude are required when saving location',
      });
    }

    if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude/longitude coordinates',
      });
    }

    const created = await Shop.create({
      routeId,
      userId: req.user._id,
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      latitude: hasLocation ? parsedLatitude : null,
      longitude: hasLocation ? parsedLongitude : null,
      shopImage: finalImage,
    });

    const populated = await Shop.findById(created._id)
      .populate('routeId', 'routeName')
      .populate('userId', 'name email roleId');

    return res.status(201).json({
      success: true,
      message: 'Shop created successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid shop data'),
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create shop',
      error: error.message,
    });
  }
};

const updateShop = async (req, res) => {
  try {
    const { routeId, shopName, shopAddress, imageUrl, latitude, longitude } = req.body;

    if (!routeId || !shopName || !shopAddress) {
      return res.status(400).json({
        success: false,
        message: 'routeId, shopName and shopAddress are required',
      });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    if (!canManageShop(req, shop)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this shop',
      });
    }

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    let nextImage = imageUrl && String(imageUrl).trim() ? String(imageUrl).trim() : shop.shopImage;
    if (req.file?.buffer) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      nextImage = uploaded.secure_url || uploaded.url || shop.shopImage;
    }

    const parsedLatitude = normalizeCoordinate(latitude, -90, 90);
    const parsedLongitude = normalizeCoordinate(longitude, -180, 180);
    const hasLocation = parsedLatitude !== null || parsedLongitude !== null;

    if (hasLocation && (parsedLatitude === null || parsedLongitude === null)) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude are required when saving location',
      });
    }

    if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude/longitude coordinates',
      });
    }

    shop.routeId = routeId;
    shop.shopName = shopName.trim();
    shop.shopAddress = shopAddress.trim();
    if (hasLocation) {
      shop.latitude = parsedLatitude;
      shop.longitude = parsedLongitude;
    }
    shop.shopImage = nextImage;

    await shop.save();

    const populated = await Shop.findById(shop._id)
      .populate('routeId', 'routeName')
      .populate('userId', 'name email roleId');

    return res.status(200).json({
      success: true,
      message: 'Shop updated successfully',
      data: populated,
    });
  } catch (error) {
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: getValidationMessage(error, 'Invalid shop data'),
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update shop',
      error: error.message,
    });
  }
};

const deleteShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    if (!canManageShop(req, shop)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this shop',
      });
    }

    await Shop.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Shop deleted successfully',
      data: shop,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete shop',
      error: error.message,
    });
  }
};

const getMyShops = async (req, res) => {
  try {
    const shops = await Shop.find({ userId: req.user._id })
      .populate('routeId', 'routeName')
      .populate('userId', 'name email roleId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'My shops fetched successfully',
      data: shops,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your shops',
      error: error.message,
    });
  }
};

const getAllShops = async (_req, res) => {
  try {
    const shops = await Shop.find({})
      .populate('routeId', 'routeName')
      .populate('userId', 'name email roleId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'All shops fetched successfully',
      data: shops,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch shops',
      error: error.message,
    });
  }
};

module.exports = {
  getShopRoutes,
  createShop,
  updateShop,
  deleteShop,
  getMyShops,
  getAllShops,
};
