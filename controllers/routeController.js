const Route = require('../models/Route');

const isAdmin = (req) => req?.user?.roleId === 1;

const getRouteScope = (req, routeId) => {
  const scope = {};

  if (routeId) {
    scope._id = routeId;
  }

  if (!isAdmin(req)) {
    scope.userId = req.user._id;
  }

  return scope;
};

const createRoute = async (req, res) => {
  try {
    const { routeName, cityName } = req.body;

    if (!routeName || !routeName.trim() || !cityName || !cityName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'routeName and cityName are required',
      });
    }

    const created = await Route.create({
      userId: req.user._id,
      routeName: routeName.trim(),
      cityName: cityName.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Route created successfully',
      data: created,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create route',
      error: error.message,
    });
  }
};

const getAllRoutes = async (req, res) => {
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

const getRouteById = async (req, res) => {
  try {
    const route = await Route.findOne(getRouteScope(req, req.params.id));

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Route fetched successfully',
      data: route,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch route',
      error: error.message,
    });
  }
};

const updateRoute = async (req, res) => {
  try {
    const { routeName, cityName } = req.body;

    if (!routeName || !routeName.trim() || !cityName || !cityName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'routeName and cityName are required',
      });
    }

    const updated = await Route.findOneAndUpdate(
      getRouteScope(req, req.params.id),
      { routeName: routeName.trim(), cityName: cityName.trim() },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Route updated successfully',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update route',
      error: error.message,
    });
  }
};

const deleteRoute = async (req, res) => {
  try {
    const deleted = await Route.findOneAndDelete(getRouteScope(req, req.params.id));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Route deleted successfully',
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete route',
      error: error.message,
    });
  }
};

module.exports = {
  createRoute,
  getAllRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
};
