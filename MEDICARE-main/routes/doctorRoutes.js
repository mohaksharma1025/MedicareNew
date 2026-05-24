const express = require('express');
const doctorController = require('../controllers/doctorController');
const upload = require('../middleware/upload');
const { isDoctor } = require('../middleware/auth');

const router = express.Router();

router.get('/doctor/register', doctorController.showRegister);
router.post('/doctor/register', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'certificates', maxCount: 5 }
]), doctorController.register);
router.get('/doctor/login', doctorController.showLogin);
router.post('/doctor/login', doctorController.login);
router.get('/doctor/dashboard', isDoctor, doctorController.showDashboard);
router.get('/doctor/appointments/:id/prescription', isDoctor, doctorController.showPrescriptionForm);
router.post('/doctor/appointments/:id/prescription', isDoctor, doctorController.savePrescription);
router.get('/doctor/logout', doctorController.logout);

module.exports = router;
