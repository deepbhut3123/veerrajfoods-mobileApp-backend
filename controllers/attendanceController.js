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

const parseAttendanceTime = (dateValue, timeValue) => {
  const normalizedDate = String(dateValue || '').trim();
  const normalizedTime = String(timeValue || '').trim().toUpperCase();

  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  const match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 1 ||
    hours > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  } else if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  }

  const parsed = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(hours, minutes, 0, 0);
  return parsed;
};

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatAttendanceResponse = (item) => ({
  ...item,
  inTime: formatTimeOnly(item.inTime),
  outTime: formatTimeOnly(item.outTime),
  breakIn: formatTimeOnly(item.breakIn),
  breakOut: formatTimeOnly(item.breakOut),
  ipAddress: normalizeIpAddress(item.ipAddress),
});

const markAttendanceCheckIn = async (userId, req) => {
  if (!userId) {
    return null;
  }

  const date = getAttendanceDate();
  const ipAddress = getClientIp(req);
  const latitude = parseCoordinate(req.body?.latitude);
  const longitude = parseCoordinate(req.body?.longitude);

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
        latitude,
        longitude,
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
  const latitude = parseCoordinate(req.body?.latitude);
  const longitude = parseCoordinate(req.body?.longitude);

  return Attendance.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        outTime: new Date(),
        ipAddress,
        latitude,
        longitude,
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

const markAttendanceBreakIn = async (userId, req) => {
  if (!userId) {
    return null;
  }

  const date = getAttendanceDate();
  const ipAddress = getClientIp(req);
  const latitude = parseCoordinate(req.body?.latitude);
  const longitude = parseCoordinate(req.body?.longitude);

  return Attendance.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        breakIn: new Date(),
        ipAddress,
        latitude,
        longitude,
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

const markAttendanceBreakOut = async (userId, req) => {
  if (!userId) {
    return null;
  }

  const date = getAttendanceDate();
  const ipAddress = getClientIp(req);
  const latitude = parseCoordinate(req.body?.latitude);
  const longitude = parseCoordinate(req.body?.longitude);

  return Attendance.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        breakOut: new Date(),
        ipAddress,
        latitude,
        longitude,
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
      breakIn: formatTimeOnly(item.breakIn),
      breakOut: formatTimeOnly(item.breakOut),
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
        breakIn: formatTimeOnly(attendance.breakIn),
        breakOut: formatTimeOnly(attendance.breakOut),
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
        breakIn: formatTimeOnly(attendance.breakIn),
        breakOut: formatTimeOnly(attendance.breakOut),
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

const markMyAttendanceBreakIn = async (req, res) => {
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

    if (existingAttendance.breakIn) {
      return res.status(400).json({
        success: false,
        message: 'Today\'s break-in already exists',
      });
    }

    const attendance = await markAttendanceBreakIn(req.user._id, req);

    return res.status(200).json({
      success: true,
      message: 'Break-in marked successfully',
      data: {
        ...attendance.toObject(),
        inTime: formatTimeOnly(attendance.inTime),
        outTime: formatTimeOnly(attendance.outTime),
        breakIn: formatTimeOnly(attendance.breakIn),
        breakOut: formatTimeOnly(attendance.breakOut),
        ipAddress: normalizeIpAddress(attendance.ipAddress),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark break-in',
      error: error.message,
    });
  }
};

const markMyAttendanceBreakOut = async (req, res) => {
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

    if (!existingAttendance?.breakIn) {
      return res.status(400).json({
        success: false,
        message: 'Please mark break-in first',
      });
    }

    if (existingAttendance.outTime) {
      return res.status(400).json({
        success: false,
        message: 'Today\'s check-out already exists',
      });
    }

    if (existingAttendance.breakOut) {
      return res.status(400).json({
        success: false,
        message: 'Today\'s break-out already exists',
      });
    }

    const attendance = await markAttendanceBreakOut(req.user._id, req);

    return res.status(200).json({
      success: true,
      message: 'Break-out marked successfully',
      data: {
        ...attendance.toObject(),
        inTime: formatTimeOnly(attendance.inTime),
        outTime: formatTimeOnly(attendance.outTime),
        breakIn: formatTimeOnly(attendance.breakIn),
        breakOut: formatTimeOnly(attendance.breakOut),
        ipAddress: normalizeIpAddress(attendance.ipAddress),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark break-out',
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
          breakIn: 1,
          breakOut: 1,
          latitude: 1,
          longitude: 1,
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
      breakIn: formatTimeOnly(item.breakIn),
      breakOut: formatTimeOnly(item.breakOut),
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

const updateAdminAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, date, inTime, outTime, breakIn, breakOut, latitude, longitude, ipAddress } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance id',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid staff user is required',
      });
    }

    const normalizedDate = String(date || '').trim();
    const normalizedIpAddress = String(ipAddress || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return res.status(400).json({
        success: false,
        message: 'Date must be in YYYY-MM-DD format',
      });
    }

    if (!normalizedIpAddress) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required',
      });
    }

    const parsedInTime = parseAttendanceTime(normalizedDate, inTime);
    if (!parsedInTime) {
      return res.status(400).json({
        success: false,
        message: 'In time must be in hh:mm AM/PM format',
      });
    }

    const parsedOutTime = outTime ? parseAttendanceTime(normalizedDate, outTime) : null;
    if (outTime && !parsedOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Out time must be in hh:mm AM/PM format',
      });
    }

    if (parsedOutTime && parsedOutTime < parsedInTime) {
      return res.status(400).json({
        success: false,
        message: 'Out time must be after in time',
      });
    }

    const parsedBreakIn = breakIn ? parseAttendanceTime(normalizedDate, breakIn) : null;
    if (breakIn && !parsedBreakIn) {
      return res.status(400).json({
        success: false,
        message: 'Break in must be in hh:mm AM/PM format',
      });
    }

    const parsedBreakOut = breakOut ? parseAttendanceTime(normalizedDate, breakOut) : null;
    if (breakOut && !parsedBreakOut) {
      return res.status(400).json({
        success: false,
        message: 'Break out must be in hh:mm AM/PM format',
      });
    }

    if (parsedBreakIn && parsedBreakIn < parsedInTime) {
      return res.status(400).json({
        success: false,
        message: 'Break in must be after in time',
      });
    }

    if (parsedBreakOut && !parsedBreakIn) {
      return res.status(400).json({
        success: false,
        message: 'Break in is required when break out is provided',
      });
    }

    if (parsedBreakIn && parsedOutTime && parsedBreakIn > parsedOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Break in must be before out time',
      });
    }

    if (parsedBreakIn && parsedBreakOut && parsedBreakOut < parsedBreakIn) {
      return res.status(400).json({
        success: false,
        message: 'Break out must be after break in',
      });
    }

    if (parsedBreakOut && parsedOutTime && parsedBreakOut > parsedOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Break out must be before out time',
      });
    }

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    const existingAttendance = await Attendance.findById(id);
    if (!existingAttendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    const staffUser = await mongoose.model('Users').findOne({
      _id: userId,
      roleId: STAFF_ROLE_ID,
    });

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      existingAttendance._id,
      {
        $set: {
          userId,
          date: normalizedDate,
          inTime: parsedInTime,
          outTime: parsedOutTime,
          breakIn: parsedBreakIn,
          breakOut: parsedBreakOut,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          ipAddress: normalizedIpAddress,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('userId', 'name email roleId');

    if (!updatedAttendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: formatAttendanceResponse({
        ...updatedAttendance.toObject(),
        user: updatedAttendance.userId
          ? {
              _id: updatedAttendance.userId._id,
              name: updatedAttendance.userId.name,
              email: updatedAttendance.userId.email,
              roleId: updatedAttendance.userId.roleId,
            }
          : null,
      }),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Another attendance record already exists for this staff user on the selected date',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update attendance',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminAttendance,
  getMyAttendance,
  markAttendanceCheckIn,
  markAttendanceCheckOut,
  markAttendanceBreakIn,
  markAttendanceBreakOut,
  markMyAttendanceCheckIn,
  markMyAttendanceCheckOut,
  markMyAttendanceBreakIn,
  markMyAttendanceBreakOut,
  updateAdminAttendance,
};

