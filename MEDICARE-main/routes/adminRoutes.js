const express = require('express');
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/login', adminController.showLogin);
router.post('/login', adminController.login);
router.get('/logout', isAdmin, adminController.logout);
router.get('/dashboard', isAdmin, adminController.dashboard);
router.get('/doctors/history', isAdmin, adminController.doctorHistory);
router.get('/doctors/pending', isAdmin, (req, res, next) => {
  req.params.status = 'pending';
  adminController.doctorsByStatus(req, res, next);
});
router.get('/doctors/approved', isAdmin, (req, res, next) => {
  req.params.status = 'approved';
  adminController.doctorsByStatus(req, res, next);
});
router.get('/doctors/rejected', isAdmin, (req, res, next) => {
  req.params.status = 'rejected';
  adminController.doctorsByStatus(req, res, next);
});
router.get('/doctors/:id/appointments', isAdmin, adminController.doctorAppointments);
router.post('/approve/:id', isAdmin, adminController.approveDoctor);
router.get('/reject/:id', isAdmin, adminController.showRejectForm);
router.post('/reject/:id', isAdmin, adminController.rejectDoctor);
router.post('/doctors/:id/delete', isAdmin, adminController.deleteDoctor);

module.exports = router;
