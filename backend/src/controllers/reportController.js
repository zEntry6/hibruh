const Report = require('../models/Report');
const Message = require('../models/Message');
const User = require('../models/User');

const VALID_TYPES = ['message', 'user'];
const VALID_REASON_CODES = ['spam', 'abuse', 'harassment', 'hate', 'self-harm', 'other', 'other'];

const shapeReport = (report) => {
  const base = {
    id: report._id.toString(),
    type: report.type,
    reasonCode: report.reasonCode,
    reasonText: report.reasonText || '',
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };

  if (report.reporterId) {
    base.reporter = {
      id: report.reporterId._id.toString(),
      username: report.reporterId.username,
      displayName: report.reporterId.displayName
    };
  }

  if (report.targetUserId) {
    base.targetUser = {
      id: report.targetUserId._id.toString(),
      username: report.targetUserId.username,
      displayName: report.targetUserId.displayName
    };
  }

  if (report.messageId) {
    base.message = {
      id: report.messageId._id.toString(),
      text: report.messageId.text,
      conversationId: report.messageId.conversationId?.toString(),
      sender: report.messageId.senderId
        ? {
            id: report.messageId.senderId._id.toString(),
            username: report.messageId.senderId.username,
            displayName: report.messageId.senderId.displayName
          }
        : null
    };
  }

  if (report.resolvedBy) {
    base.resolvedBy = {
      id: report.resolvedBy._id.toString(),
      username: report.resolvedBy.username,
      displayName: report.resolvedBy.displayName
    };
  }

  if (report.resolutionNote) {
    base.resolutionNote = report.resolutionNote;
  }

  return base;
};

// POST /api/reports
exports.createReport = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { type, messageId, targetUserId, reasonCode, reasonText } = req.body;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid report type' });
    }
    if (!VALID_REASON_CODES.includes(reasonCode)) {
      return res.status(400).json({ message: 'Invalid reason code' });
    }

    let finalTargetUserId = targetUserId || null;
    let finalMessageId = messageId || null;
    let conversationId = null;

    if (type === 'message') {
      if (!messageId) {
        return res
          .status(400)
          .json({ message: 'messageId is required for message report' });
      }

      const message = await Message.findById(messageId)
        .populate('senderId', 'username displayName')
        .lean();

      if (!message) {
        return res.status(404).json({ message: 'Message not found' });
      }

      conversationId = message.conversationId;
      finalTargetUserId = message.senderId?._id || null;
    }

    if (type === 'user') {
      if (!finalTargetUserId) {
        return res
          .status(400)
          .json({ message: 'targetUserId is required for user report' });
      }

      if (String(finalTargetUserId) === String(reporterId)) {
        return res
          .status(400)
          .json({ message: 'You cannot report yourself' });
      }

      const targetUser = await User.findById(finalTargetUserId).select(
        '_id'
      );
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }
    }

    // cegah report ganda untuk objek yang sama oleh user yang sama
    const existing = await Report.findOne({
      reporterId,
      type,
      messageId: finalMessageId,
      targetUserId: finalTargetUserId
    });
    if (existing) {
      return res.status(200).json({
        message: 'You already reported this',
        report: shapeReport(existing),
        alreadyReported: true
      });
    }

    const report = await Report.create({
      reporterId,
      type,
      messageId: finalMessageId,
      targetUserId: finalTargetUserId,
      conversationId,
      reasonCode,
      reasonText: reasonText || undefined
    });

    const populated = await Report.findById(report._id)
      .populate('reporterId', 'username displayName')
      .populate('targetUserId', 'username displayName')
      .populate('messageId', 'text conversationId senderId')
      .populate('messageId.senderId', 'username displayName');

    return res.status(201).json({ report: shapeReport(populated) });
  } catch (err) {
    console.error('createReport error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/reports/my
exports.getMyReports = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Report.find({ reporterId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporterId', 'username displayName')
        .populate('targetUserId', 'username displayName')
        .populate('messageId', 'text conversationId senderId')
        .populate('messageId.senderId', 'username displayName')
        .populate('resolvedBy', 'username displayName'),
      Report.countDocuments({ reporterId })
    ]);

    return res.json({
      items: items.map(shapeReport),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error('getMyReports error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/reports?status=open|in_review|resolved|dismissed
exports.getAllReports = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reporterId', 'username displayName')
        .populate('targetUserId', 'username displayName')
        .populate('messageId', 'text conversationId senderId')
        .populate('messageId.senderId', 'username displayName')
        .populate('resolvedBy', 'username displayName'),
      Report.countDocuments(filter)
    ]);

    return res.json({
      items: items.map(shapeReport),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error('getAllReports error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/reports/:id
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id)
      .populate('reporterId', 'username displayName')
      .populate('targetUserId', 'username displayName')
      .populate('messageId', 'text conversationId senderId')
      .populate('messageId.senderId', 'username displayName')
      .populate('resolvedBy', 'username displayName');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.json({ report: shapeReport(report) });
  } catch (err) {
    console.error('getReportById error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/reports/:id
exports.updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    if (!['open', 'in_review', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    report.status = status;

    if (status === 'open') {
      report.resolvedBy = undefined;
      report.resolutionNote = undefined;
    } else {
      report.resolvedBy = req.user._id;
      if (typeof resolutionNote === 'string') {
        report.resolutionNote = resolutionNote;
      }
    }

    await report.save();

    const populated = await Report.findById(report._id)
      .populate('reporterId', 'username displayName')
      .populate('targetUserId', 'username displayName')
      .populate('messageId', 'text conversationId senderId')
      .populate('messageId.senderId', 'username displayName')
      .populate('resolvedBy', 'username displayName');

    return res.json({ report: shapeReport(populated) });
  } catch (err) {
    console.error('updateReportStatus error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
