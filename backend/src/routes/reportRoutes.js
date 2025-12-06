const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const reportController = require('../controllers/reportController');

// middleware kecil untuk cek admin, pakai field isAdmin yang baru ditambah
const requireAdmin = (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// buat report (user biasa)
router.post('/', authMiddleware, reportController.createReport);

// list report milik diri sendiri
router.get('/my', authMiddleware, reportController.getMyReports);

// list semua report (admin-only)
router.get('/', authMiddleware, requireAdmin, reportController.getAllReports);

// detail report (admin-only)
router.get('/:id', authMiddleware, requireAdmin, reportController.getReportById);

// update status report (admin-only)
router.patch(
  '/:id',
  authMiddleware,
  requireAdmin,
  reportController.updateReportStatus
);

module.exports = router;
