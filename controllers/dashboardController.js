const Route = require('../models/Route');
const Shop = require('../models/Shop');

const getAdminDashboardSummary = async (_req, res) => {
  try {
    const [routesCount, shopsCount] = await Promise.all([
      Route.countDocuments({}),
      Shop.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary fetched successfully',
      data: {
        routesCount,
        shopsCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error.message,
    });
  }
};

const getAllAdminRoutes = async (_req, res) => {
  try {
    const routes = await Route.find({})
      .populate('userId', 'name email roleId')
      .sort({ createdAt: -1 });

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

module.exports = {
  getAdminDashboardSummary,
  getAllAdminRoutes,
};
