const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

const ATTENDANCE_TIMEZONE = process.env.ATTENDANCE_TIMEZONE || 'Asia/Kolkata';
const STAFF_ROLE_ID = 5;

const getAttendanceDate = (value = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const normalizeIpAddress = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'unknown';
  }

  if (raw.startsWith('::ffff:')) {
    return raw.slice(7);
  }

  if (raw === '::1') {
    return '127.0.0.1';
  }

  return raw;
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return normalizeIpAddress(forwarded.split(',')[0].trim());
  }

  return normalizeIpAddress(
    req.ip ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      'unknown'
  );
};

const formatTimeOnly = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const markAttendanceCheckIn = async (userId, req) => {
  if (!userId) {
    return null;
  }

  const date = getAttendanceDate();
  const ipAddress = getClientIp(req);

  return Attendance.findOneAndUpdate(
    { userId, date },
    {
      $setOnInsert: {
        userId,
        date,
        inTime: new Date(),
      },
      $set: {
        ipAddress,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );
};

const markAttendanceCheckOut = async (userId, req) => {
  if (!userId) {
    return null;
  }

  const date = getAttendanceDate();
  const ipAddress = getClientIp(req);

  return Attendance.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        outTime: new Date(),
        ipAddress,
      },
      $setOnInsert: {
        userId,
        date,
        inTime: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );
};

const getMyAttendance = async (req, res) => {
  try {
    if (Number(req.user?.roleId) !== STAFF_ROLE_ID) {
      return res.status(403).json({
        success: false,
        message: 'Staff access required',
      });
    }

    const data = await Attendance.find({ userId: req.user._id })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const formattedData = data.map((item) => ({
      ...item,
      inTime: formatTimeOnly(item.inTime),
      outTime: formatTimeOnly(item.outTime),
      ipAddress: normalizeIpAddress(item.ipAddress),
    }));

    return res.status(200).json({
      success: true,
      message: 'Attendance fetched successfully',
      data: formattedData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance',
      error: error.message,
    });
  }
};

const markMyAttendanceCheckIn = async (req, res) => {
  try {
    if (Number(req.user?.roleId) !== STAFF_ROLE_ID) {
      return res.status(403).json({
        success: false,
        message: 'Staff access required',
      });
    }

    const date = getAttendanceDate();
    const existingAttendance = await Attendance.findOne({ userId: req.user._id, date });

    if (existingAttendance?.inTime) {
      return res.status(400).json({
        success: false,
        message: 'Today\'s check-in already exists',
      });
    }

    const attendance = await markAttendanceCheckIn(req.user._id, req);

    return res.status(200).json({
      success: true,
      message: 'Check-in marked successfully',
      data: {
        ...attendance.toObject(),
        inTime: formatTimeOnly(attendance.inTime),
        outTime: formatTimeOnly(attendance.outTime),
        ipAddress: normalizeIpAddress(attendance.ipAddress),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark check-in',
      error: error.message,
    });
  }
};

const markMyAttendanceCheckOut = async (req, res) => {
  try {
    if (Number(req.user?.roleId) !== STAFF_ROLE_ID) {
      return res.status(403).json({
        success: false,
        message: 'Staff access required',
      });
    }

    const date = getAttendanceDate();
    const existingAttendance = await Attendance.findOne({ userId: req.user._id, date });

    if (!existingAttendance?.inTime) {
      return res.status(400).json({
        success: false,
        message: 'Please mark check-in first',
      });
    }

    if (existingAttendance.outTime) {
      return res.status(400).json({
        success: false,
        message: 'Today\'s check-out already exists',
      });
    }

    const attendance = await markAttendanceCheckOut(req.user._id, req);

    return res.status(200).json({
      success: true,
      message: 'Check-out marked successfully',
      data: {
        ...attendance.toObject(),
        inTime: formatTimeOnly(attendance.inTime),
        outTime: formatTimeOnly(attendance.outTime),
        ipAddress: normalizeIpAddress(attendance.ipAddress),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark check-out',
      error: error.message,
    });
  }
};
const getAdminAttendance = async (req, res) => {
  try {
    const { search, userId, fromDate, toDate } = req.query;
    const matchStage = {};

    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      matchStage.userId = new mongoose.Types.ObjectId(String(userId));
    }

    if (fromDate || toDate) {
      matchStage.date = {};

      if (fromDate) {
        matchStage.date.$gte = String(fromDate);
      }

      if (toDate) {
        matchStage.date.$lte = String(toDate);
      }
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    pipeline.push({
      $match: {
        'user.roleId': STAFF_ROLE_ID,
      },
    });

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: String(search), $options: 'i' } },
            { 'user.email': { $regex: String(search), $options: 'i' } },
            { ipAddress: { $regex: String(search), $options: 'i' } },
          ],
        },
      });
    }

    pipeline.push(
      {
        $project: {
          userId: 1,
          date: 1,
          inTime: 1,
          outTime: 1,
          ipAddress: 1,
          createdAt: 1,
          updatedAt: 1,
          user: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email',
            roleId: '$user.roleId',
          },
        },
      },
      {
        $sort: {
          date: -1,
          inTime: -1,
        },
      }
    );

    const data = await Attendance.aggregate(pipeline);
    const formattedData = data.map((item) => ({
      ...item,
      inTime: formatTimeOnly(item.inTime),
      outTime: formatTimeOnly(item.outTime),
      ipAddress: normalizeIpAddress(item.ipAddress),
    }));

    return res.status(200).json({
      success: true,
      message: 'Attendance fetched successfully',
      data: formattedData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminAttendance,
  getMyAttendance,
  markAttendanceCheckIn,
  markAttendanceCheckOut,
  markMyAttendanceCheckIn,
  markMyAttendanceCheckOut,
};

