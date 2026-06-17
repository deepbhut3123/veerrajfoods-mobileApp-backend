const Route = require('../models/Route');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Bill = require('../models/Bill');
const User = require('../models/User');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAdminDashboardSummary = async (req, res) => {
  try {
    const now = new Date();
    const requestedMonth = Number(req.query.month);
    const requestedYear = Number(req.query.year);
    const month =
      Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
        ? requestedMonth
        : now.getMonth() + 1;
    const year =
      Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 9999
        ? requestedYear
        : now.getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const shippedMatch = {
      status: 'shipped',
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };

    const [routesCount, shopsCount, productsCount, shippedBillsCount, shippedByUser, users, billYears] =
      await Promise.all([
        Route.countDocuments({}),
        Shop.countDocuments({}),
        Product.countDocuments({}),
        Bill.countDocuments(shippedMatch),
        Bill.aggregate([
          { $match: shippedMatch },
          {
            $group: {
              _id: '$userId',
              shippedBillsCount: { $sum: 1 },
            },
          },
          { $sort: { shippedBillsCount: -1 } },
        ]),
        User.find({}).select('name email roleId isActive').sort({ name: 1 }),
        Bill.aggregate([
          {
            $group: {
              _id: { $year: '$createdAt' },
            },
          },
          { $sort: { _id: -1 } },
        ]),
      ]);

    const shippedByUserMap = new Map(
      shippedByUser.map((item) => [String(item._id), item.shippedBillsCount])
    );
    const monthlyShippedByUser = users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      isActive: user.isActive,
      shippedBillsCount: shippedByUserMap.get(String(user._id)) || 0,
    }));
    const availableYears = billYears.map((item) => item._id).filter(Boolean);

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary fetched successfully',
      data: {
        routesCount,
        shopsCount,
        productsCount,
        shippedBillsCount,
        selectedMonth: month,
        selectedYear: year,
        availableYears: availableYears.length ? availableYears : [now.getFullYear()],
        monthlyShippedByUser,
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

const getAllAdminRoutes = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    let filter = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const matchingUsers = await User.find({
        $or: [{ name: regex }, { email: regex }],
      }).select('_id');

      const userIds = matchingUsers.map((user) => user._id);
      filter = {
        $or: [
          { routeName: regex },
          { cityName: regex },
          ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
        ],
      };
    }

    const routes = await Route.find(filter)
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
