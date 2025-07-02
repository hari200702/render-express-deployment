const express = require('express');
const router = express.Router();

const { employeeLogin, employeeLogout } = require('../controllers/authController')
const { authenticateEmployee } = require('../middleware/authMiddleware');

router.post('/employee/login', employeeLogin);
router.post('/employee/logout', authenticateEmployee, employeeLogout);

module.exports = router;