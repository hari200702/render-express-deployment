const express = require('express');
const router = express.Router();
const {
    getDashboard,
    getProfile,
    updateProfile,
    uploadLeads,
    getLeads,
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
} = require('../controllers/adminController');
const { validateEmployeeData } = require('../middleware/validationMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/dashboard', getDashboard);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.post('/leads/upload', upload.single('leads'), uploadLeads);

router.get('/leads', getLeads);

router.get('/employees', getEmployees);
router.post('/employees', validateEmployeeData, createEmployee);
router.put('/employees/:id', updateEmployee);
router.delete('/employees/:id', deleteEmployee);

module.exports = router;