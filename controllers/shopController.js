const Route = require('../models/Route');
const Shop = require('../models/Shop');
const User = require('../models/User');
const mongoose = require('mongoose');
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

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const getRouteScope = (req, routeId) => {
  const scope = {};

  if (routeId) {
    scope._id = routeId;
  }

  if (req.user?.roleId !== 1) {
    scope.userId = req.user._id;
  }

  return scope;
};

const getNextShopSequence = async (routeId) => {
  const lastShop = await Shop.findOne({ routeId }).sort({ sequence: -1 }).select('sequence');
  return Math.max(0, Number(lastShop?.sequence) || 0) + 1;
};

const sortShopsWithinRoutes = (shops) => {
  const groups = new Map();
  for (const shop of shops) {
    const routeId = String(shop.routeId?._id || shop.routeId || '');
    if (!groups.has(routeId)) groups.set(routeId, []);
    groups.get(routeId).push(shop);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => (Number(left.sequence) || 0) - (Number(right.sequence) || 0));
  }
  const indexes = new Map();
  return shops.map((shop) => {
    const routeId = String(shop.routeId?._id || shop.routeId || '');
    const index = indexes.get(routeId) || 0;
    indexes.set(routeId, index + 1);
    return groups.get(routeId)[index];
  });
};

const getShopRoutes = async (req, res) => {
  try {
    const routes = await Route.find(getRouteScope(req)).sort({ createdAt: -1 });
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
    const { routeId, shopName, shopNameGujarati, shopAddress, mobileNumber, imageUrl, latitude, longitude } = req.body;

    if (!routeId || !shopName || !shopAddress || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'routeId, shopName, shopAddress and mobileNumber are required',
      });
    }

    const route = await Route.findOne(getRouteScope(req, routeId));
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
      shopNameGujarati: shopNameGujarati && shopNameGujarati.trim() ? shopNameGujarati.trim() : '',
      shopAddress: shopAddress.trim(),
      mobileNumber: mobileNumber.trim(),
      latitude: hasLocation ? parsedLatitude : null,
      longitude: hasLocation ? parsedLongitude : null,
      shopImage: finalImage,
      sequence: await getNextShopSequence(routeId),
    });

    const populated = await Shop.findById(created._id)
      .populate('routeId', 'routeName routeNameGujarati cityName cityNameGujarati')
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
    const { routeId, shopName, shopNameGujarati, shopAddress, mobileNumber, imageUrl, latitude, longitude } = req.body;

    if (!routeId || !shopName || !shopAddress || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'routeId, shopName, shopAddress and mobileNumber are required',
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

    const route = await Route.findOne(getRouteScope(req, routeId));
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

    if (String(shop.routeId) !== String(routeId)) {
      shop.sequence = await getNextShopSequence(routeId);
    }
    shop.routeId = routeId;
    shop.shopName = shopName.trim();
    shop.shopNameGujarati = shopNameGujarati && shopNameGujarati.trim() ? shopNameGujarati.trim() : '';
    shop.shopAddress = shopAddress.trim();
    shop.mobileNumber = mobileNumber.trim();
    if (hasLocation) {
      shop.latitude = parsedLatitude;
      shop.longitude = parsedLongitude;
    } else {
      shop.latitude = null;
      shop.longitude = null;
    }
    shop.shopImage = nextImage;

    await shop.save();

    const populated = await Shop.findById(shop._id)
      .populate('routeId', 'routeName routeNameGujarati cityName cityNameGujarati')
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

const moveShopToRoute = async (req, res) => {
  try {
    const { routeId } = req.body || {};
    if (!mongoose.isValidObjectId(routeId)) {
      return res.status(400).json({ success: false, message: 'A valid routeId is required' });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    if (!canManageShop(req, shop)) {
      return res.status(403).json({ success: false, message: 'Not authorized to move this shop' });
    }

    const route = await Route.findOne(getRouteScope(req, routeId));
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    if (String(shop.routeId) !== String(routeId)) {
      shop.sequence = await getNextShopSequence(routeId);
      shop.routeId = routeId;
      await shop.save();
    }

    const populated = await Shop.findById(shop._id)
      .populate('routeId', 'routeName routeNameGujarati cityName cityNameGujarati')
      .populate('userId', 'name email roleId');

    return res.status(200).json({
      success: true,
      message: 'Shop moved to route successfully',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to move shop to route',
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
      .populate('routeId', 'routeName routeNameGujarati cityName cityNameGujarati')
      .populate('userId', 'name email roleId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'My shops fetched successfully',
      data: sortShopsWithinRoutes(shops),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your shops',
      error: error.message,
    });
  }
};

const getAllShops = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    let filter = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const [matchingRoutes, matchingUsers] = await Promise.all([
        Route.find({
          $or: [
            { routeName: regex },
            { routeNameGujarati: regex },
            { cityName: regex },
            { cityNameGujarati: regex },
          ],
        }).select('_id'),
        User.find({
          $or: [{ name: regex }, { email: regex }],
        }).select('_id'),
      ]);

      const routeIds = matchingRoutes.map((route) => route._id);
      const userIds = matchingUsers.map((user) => user._id);

      filter = {
        $or: [
          { shopName: regex },
          { shopNameGujarati: regex },
          { shopAddress: regex },
          { mobileNumber: regex },
          ...(routeIds.length ? [{ routeId: { $in: routeIds } }] : []),
          ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ],
      };
    }

    const shops = await Shop.find(filter)
      .populate('routeId', 'routeName routeNameGujarati cityName cityNameGujarati')
      .populate('userId', 'name email roleId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'All shops fetched successfully',
      data: sortShopsWithinRoutes(shops),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch shops',
      error: error.message,
    });
  }
};

const reorderRouteShops = async (req, res) => {
  try {
    const { id: routeId } = req.params;
    const { shopIds } = req.body || {};

    if (!mongoose.isValidObjectId(routeId) || !Array.isArray(shopIds) ||
        shopIds.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id)) ||
        new Set(shopIds).size !== shopIds.length) {
      return res.status(400).json({ success: false, message: 'Provide each shop ID once in shopIds' });
    }

    const route = await Route.findOne(getRouteScope(req, routeId));
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    const shops = await Shop.find({ routeId }).select('_id');
    const existingIds = new Set(shops.map((shop) => String(shop._id)));
    if (shopIds.length !== shops.length || shopIds.some((id) => !existingIds.has(id))) {
      return res.status(400).json({
        success: false,
        message: 'shopIds must contain every shop assigned to this route exactly once',
      });
    }

    if (shopIds.length) {
      await Shop.bulkWrite(shopIds.map((shopId, index) => ({
        updateOne: {
          filter: { _id: shopId, routeId },
          update: { $set: { sequence: index + 1 } },
        },
      })));
    }

    const orderedShops = await Shop.find({ routeId })
      .populate('routeId', 'routeName routeNameGujarati cityName cityNameGujarati')
      .populate('userId', 'name email roleId')
      .sort({ sequence: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Shop sequence updated successfully',
      data: orderedShops,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder shops',
      error: error.message,
    });
  }
};

module.exports = {
  getShopRoutes,
  createShop,
  updateShop,
  moveShopToRoute,
  deleteShop,
  getMyShops,
  getAllShops,
  reorderRouteShops,
};
