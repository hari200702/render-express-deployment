const express = require('express');
const router = express.Router();
const { authenticateEmployee  } = require('../middleware/authMiddleware')
const { getEmployeeHome,
        getEmployeeLeads,
        updateLeadTemperature,
        closeLead,
        scheduleAppointment,
        getEmployeeSchedule,
        getEmployeeProfile,
        updateEmployeeProfile,
        getEmployeeLeadsByStatus,
        getEmployeeScheduleByType,
        searchEmployeeLeads,
        searchEmployeeSchedule
} = require('../controllers/employeeController');

router.use(authenticateEmployee);


router.get('/home', getEmployeeHome);


router.get('/leads', getEmployeeLeads);
router.put('/leads/:id/temperature', updateLeadTemperature);
router.put('/leads/:id/close', closeLead);
router.post('/leads/:id/appointment', scheduleAppointment);



router.get('/schedule', getEmployeeSchedule);

router.get('/profile', getEmployeeProfile)


router.put('/profile', updateEmployeeProfile);

router.get('/leads/filter', getEmployeeLeadsByStatus);

router.get('/schedule/filter', getEmployeeScheduleByType);

router.get('/leads/search', searchEmployeeLeads);

router.get('/schedule/search', searchEmployeeSchedule);
module.exports = router;