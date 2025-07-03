const Attendance = require('../models/Attendance')
const Employee = require('../models/Employee')
const { asyncHandler,AppError } = require('../middleware/errorMiddleware')
const Lead = require('../models/Lead')
const { logActivity , ACTIVITY_TYPES }= require("../utils/activitylogger")
const ActivityLog = require("../models/ActivityLog")
const bcrypt = require('bcryptjs');

const getEmployeeHome = asyncHandler(async (req, res) => {
    const { employeeId } = req;
    

    const employee = await Employee.findById(employeeId)
        .select('firstName lastName lastLogin');

    
    let checkInTime = '';
    
    if (employee.lastLogin) {
        checkInTime = employee.lastLogin.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
    }

    console.log(checkInTime)
    const attendanceWithBreaks = await Attendance.find({
        employeeId: employeeId,
        'breaks.0': { $exists: true }
    })
    .sort({ date: -1 })
    .limit(10);

    const allBreaks = [];
    for (const record of attendanceWithBreaks) {
        for (const brk of record.breaks) {
            if (brk.startTime) {
                allBreaks.push({
                    break: brk.startTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true ,
                        timeZone: 'Asia/Kolkata' 
                    }),
                    ended: brk.endTime ? brk.endTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Kolkata' 
                    }) : 'Ongoing',
                    date: record.date.toLocaleDateString('en-US', { 
                        month: '2-digit', 
                        day: '2-digit', 
                        year: '2-digit',
                        timeZone: 'Asia/Kolkata' 
                    })
                });
            }
        }
        if (allBreaks.length >= 5) break;
    }
    const recentActivity = await getEmployeeActivitySummary(employeeId, 3);

    const nowInIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const hourIST = new Date(nowInIST).getHours();

    let greeting = '';
    if (hourIST >= 0 && hourIST < 12) {
      greeting = 'Good Morning';
    } else if (hourIST >= 12 && hourIST < 16) {
      greeting = 'Good Afternoon';
    } else if (hourIST >= 16 && hourIST < 19) {
      greeting = 'Good Evening';
    } else {
      greeting = 'Good Night';
    }

    res.json({
        success: true,
        data: {
            greeting,
            employee: {
                name: `${employee.firstName} ${employee.lastName}`
            },
            timings: {
                checkedIn: checkInTime,  
                checkOut: '--:-- --'
            },
            breakHistory: allBreaks.slice(0, 5),
            activityFeed:recentActivity
        }
    });
});

const getEmployeeLeads = asyncHandler(async (req, res) => {
  const { employeeId } = req;

  const leads = await Lead.find({ 
      assignedTo: employeeId 
  })
  .sort({ assignedDate: -1 })
  .select('name email status leadStatus assignedDate appointment'); 

  const formattedLeads = leads.map(lead => ({
      _id: lead._id,
      name: lead.name,
      email: lead.email,
      temperature: lead.status,
      leadStatus: lead.leadStatus,
      assignedDate: lead.assignedDate,
      appointmentDate: !!lead.appointment?.date
  }));

  res.json({
      success: true,
      count: formattedLeads.length,
      data: formattedLeads
  });
});


const updateLeadTemperature = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { temperature } = req.body;
    const { employeeId } = req;

    
    if (!temperature || !['hot', 'cold', 'warm'].includes(temperature)) {
        throw new AppError('Please provide valid temperature (hot/cold/warm)', 400);
    }

    

    const lead = await Lead.findOne({ 
        _id: id, 
        assignedTo: employeeId 
    });

    if (!lead) {
   
        throw new AppError('Lead not found or not assigned to you', 404);
    }



    const previousTemp = lead.status;
    lead.status = temperature;
    await lead.save();


    res.json({
        success: true,
        message: `Lead temperature updated to ${temperature}`,
        data: {
            leadId: lead._id,
            temperature: lead.status
        }
    });
});


const closeLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { employeeId } = req;

    const employee = await Employee.findById(employeeId).select('firstName lastName');

    const lead = await Lead.findOne({ 
        _id: id, 
        assignedTo: employeeId 
    });

    if (!lead) {
        throw new AppError('Lead not found or not assigned to you', 404);
    }

    if (lead.leadStatus === 'closed') {
        throw new AppError('Lead is already closed', 400);
    }

    if (lead.appointment?.date) {
        const appointmentDate = new Date(lead.appointment.date);
        const today = new Date();
        
        if (appointmentDate > today) {
            throw new AppError('Cannot close lead with future appointment. Please wait until after the appointment date.', 400);
        }
    }

    lead.leadStatus = 'closed';
    lead.closedDate = new Date();
    lead.appointment = undefined;
    await lead.save();

    await logActivity(ActivityLog, {
        action: ACTIVITY_TYPES.LEAD_CLOSED,
        performedBy: employeeId,
        performerModel: 'Employee',
        targetId: lead._id,
        targetType: 'Lead',
        employeeDetails: {
            id: employeeId,
            name: `${employee.firstName} ${employee.lastName}`
        },
        newData: { leadStatus: 'closed' }
    });

    res.json({
        success: true,
        message: 'Lead closed successfully',
        data: {
            leadId: lead._id,
            closedDate: lead.closedDate
        }
    });
});

const scheduleAppointment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date, timeSlot, } = req.body;
    const { employeeId } = req;



    if (!date || !timeSlot) {
        throw new AppError('Please provide appointment date and time slot', 400);
    }


    const appointmentDate = new Date(date);
    const now = new Date();


    if (appointmentDate < now) {
        throw new AppError('Appointment date must be in the future', 400);
    }



    const lead = await Lead.findOne({ 
        _id: id, 
        assignedTo: employeeId 
    });


    if (!lead) {
        throw new AppError('Lead not found or not assigned to you', 404);
    }

    if(lead.leadStatus==="closed"){
        throw new AppError('Lead is Already Closed', 400);
    }

  
    if (appointmentDate <= lead.assignedDate) {
        throw new AppError('Appointment date must be after the lead assignment date', 400);
    }



    const conflictingAppointment = await Lead.findOne({
        assignedTo: employeeId,
        _id: { $ne: id }, 
        'appointment.date': appointmentDate,
        'appointment.timeSlot': timeSlot
    });



    if (conflictingAppointment) {
        throw new AppError(`Time slot ${timeSlot} on ${appointmentDate.toLocaleDateString()} is already booked`, 409);
    }




    lead.appointment = {
        date: appointmentDate,
        timeSlot: timeSlot,
    };
    await lead.save();


    

    res.json({
        success: true,
        message: 'Appointment scheduled successfully',
        data: {
            leadId: lead._id,
            appointment: lead.appointment
        }
    });
});

const getEmployeeSchedule = asyncHandler(async (req, res) => {
  const { employeeId } = req;

  const query = {
    assignedTo: employeeId,
    leadStatus: 'open',
    'appointment.date': { $exists: true, $ne: null }
  };

  const appointments = await Lead.find(query)
    .select('name phone appointment.date appointment.timeSlot callType')
    .sort({ 'appointment.date': 1 });

  const formattedAppointments = appointments.map(lead => ({
    _id: lead._id,
    name: lead.name,
    phone: lead.phone,
    date: lead.appointment.date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      timeZone: 'Asia/Kolkata'
    }),
    time: "Call",
    callType: lead.callType || 'cold_call',
    appointmentDateTime: lead.appointment.date
  }));

  res.json({
    success: true,
    count: formattedAppointments.length,
    data: formattedAppointments
  });
});



const getEmployeeProfile = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.employeeId);

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  res.json({
    success: true,
    data: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email
    }
  });
});


const updateEmployeeProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  const employee = await Employee.findById(req.employeeId);

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  const updates = [];

  if (firstName && firstName !== employee.firstName) {
    employee.firstName = firstName;
    updates.push('firstName');
  }


  if (lastName && lastName !== employee.lastName) {
    employee.lastName = lastName;
    updates.push('lastName');
  }



  if (email && email !== employee.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Invalid email format', 400);
    }
    employee.email = email;
    updates.push('email');
  }



  if (password) {

    if (!confirmPassword) {
      throw new AppError('Please confirm your password', 400);
    }

    if (password !== confirmPassword) {
      throw new AppError('Passwords do not match', 400);
    }


    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const isSamePassword = await bcrypt.compare(password, employee.password);

    if (isSamePassword) {
        throw new AppError('New password must be different from the current password', 400);
    }


    const salt = await bcrypt.genSalt(10);
    employee.password = await bcrypt.hash(password, salt);
    updates.push('password');


  }

  if (updates.length > 0) {
    await employee.save();
  }

  res.json({
    success: true,
    message: updates.length > 0
      ? `Profile updated successfully. Updated: ${updates.join(', ')}`
      : 'No changes made',
    data: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email
    }
  });
});



const getEmployeeLeadsByStatus = asyncHandler(async (req, res) => {
  const { employeeId } = req;
  const { leadStatus } = req.query; 

  if (!leadStatus || !['open', 'closed'].includes(leadStatus.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'Invalid or missing status' });
  }

  const leads = await Lead.find({
    assignedTo: employeeId,
    leadStatus: leadStatus.toLowerCase()
  })
    .sort({ assignedDate: -1 })
    .select('name email status leadStatus assignedDate appointment ');

  const formattedLeads = leads.map(lead => ({
    _id: lead._id,
    name: lead.name,
    email: lead.email,
    temperature: lead.status, 
    leadStatus: lead.leadStatus, 
    assignedDate: lead.assignedDate,
    appointmentDate: !!lead.appointment?.date
  }));

  res.json({
    success: true,
    count: formattedLeads.length,
    data: formattedLeads
  });
});


const getEmployeeScheduleByType = asyncHandler(async (req, res) => {
  const { employeeId } = req;
  const { type } = req.query;

  if (!type || !['today', 'all'].includes(type.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Query param type must be either "today" or "all"'
    });
  }

  const query = {
    assignedTo: employeeId,
    'appointment.date': { $exists: true }
  };

  if (type.toLowerCase() === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    query['appointment.date'] = { $gte: today, $lt: tomorrow };
  }

  const leadsWithAppointments = await Lead.find(query)
    .sort({ 'appointment.date': 1 })
    .select('name phone appointment.date appointment.timeSlot callType');

  const formatted = leadsWithAppointments.map(lead => ({
    _id: lead._id,
    name: lead.name,
    phone: lead.phone,
    date: lead.appointment.date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      timeZone: 'Asia/Kolkata'
    }),
    time: "Call",
    callType: lead.callType || 'cold_call',
    appointmentDateTime: lead.appointment.date
  }));

  res.json({
    success: true,
    count: formatted.length,
    data: formatted
  });
});


const searchEmployeeLeads = asyncHandler(async (req, res) => {
  const { employeeId } = req;
  const { q } = req.query;

  if (!q || q.trim() === '') {
    const leads = await Lead.find({ assignedTo: employeeId })
      .sort({ assignedDate: -1 })
      .select('name email status leadStatus assignedDate appointment');

    const formattedLeads = leads.map(lead => ({
      _id: lead._id,
      name: lead.name,
      email: lead.email,
      temperature: lead.status,
      leadStatus: lead.leadStatus,
      assignedDate: lead.assignedDate,
      appointmentDate: !!lead.appointment?.date
    }));

    return res.json({ success: true, count: formattedLeads.length, data: formattedLeads });
  }

  
  let regex = new RegExp(q, 'i');

  
  if (/^\d{1,2}$/.test(q)) {
    const padded = q.padStart(2, '0');
    regex = new RegExp(`-${padded}`, 'i');
  }

  const leads = await Lead.find({
    assignedTo: employeeId,
    $or: [
      { name: regex },
      { email: regex },
      { phone: regex },
      { status: regex },
      { leadStatus: regex },
      { location: regex },
      { language: regex },
      {
        $expr: {
          $regexMatch: {
            input: { $dateToString: { format: '%Y-%m-%d', date: '$assignedDate' } },
            regex: regex.source,
            options: 'i'
          }
        }
      }
    ]
  })
    .sort({ assignedDate: -1 })
    .select('name email status leadStatus assignedDate appointment');

  const formattedLeads = leads.map(lead => ({
    _id: lead._id,
    name: lead.name,
    email: lead.email,
    temperature: lead.status,
    leadStatus: lead.leadStatus,
    assignedDate: lead.assignedDate,
    appointmentDate: !!lead.appointment?.date
  }));

  res.json({ success: true, count: formattedLeads.length, data: formattedLeads });
});



const searchEmployeeSchedule = asyncHandler(async (req, res) => {
  const { employeeId } = req;
  const { q } = req.query;

  const baseQuery = {
    assignedTo: employeeId,
    'appointment.date': { $exists: true }
  };

  let searchQuery = baseQuery;

  if (q && q.trim() !== '') {
    let regex = new RegExp(q, 'i');


    if (/^\d{1,2}$/.test(q)) {
      const padded = q.padStart(2, '0');
      regex = new RegExp(`-${padded}`, 'i'); 
    }

    searchQuery = {
      ...baseQuery,
      $or: [
        { name: regex },
        { phone: regex },
        { callType: regex },
        { 'appointment.timeSlot': regex },
        {
          $expr: {
            $regexMatch: {
              input: {
                $dateToString: { format: '%Y-%m-%d', date: '$appointment.date' }
              },
              regex: regex.source,
              options: 'i'
            }
          }
        }
      ]
    };
  }

  const leadsWithAppointments = await Lead.find(searchQuery)
    .sort({ 'appointment.date': 1 })
    .select('name phone callType appointment.date appointment.timeSlot');

  const formatted = leadsWithAppointments.map(lead => ({
    _id: lead._id,
    name: lead.name,
    phone: lead.phone,
    date: lead.appointment.date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      timeZone: 'Asia/Kolkata'
    }),
    time: 'Call',
    callType: lead.callType || 'cold_call',
    appointmentDateTime: lead.appointment.date
  }));

  res.json({
    success: true,
    count: formatted.length,
    data: formatted
  });
});



// Helper function for employee activities
const getEmployeeActivitySummary = async (employeeId) => {
    const assignedCount = await Lead.countDocuments({ assignedTo: employeeId });

    const closedCount = await Lead.countDocuments({ 
        assignedTo: employeeId,
        leadStatus: 'closed' 
    });

    const latestAssigned = await ActivityLog.findOne({
        action: ACTIVITY_TYPES.LEAD_ASSIGNED,
        'employeeDetails.id': employeeId
    }).sort({ timestamp: -1 });

    const latestClosed = await ActivityLog.findOne({
        action: ACTIVITY_TYPES.LEAD_CLOSED,
        'employeeDetails.id': employeeId
    }).sort({ timestamp: -1 });

    return {
        assignedCount,
        closedCount,
        latestAssigned: latestAssigned ? {
            message: `You were assigned with new leads with total ${assignedCount}`,
            timeAgo: getTimeAgo(latestAssigned.timestamp)
        } : null,
        latestClosed: latestClosed ? {
            message: `You closed a lead`,
            timeAgo: getTimeAgo(latestClosed.timestamp)
        } : null
    };
};

function getTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMins > 0) {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}



module.exports = {
    getEmployeeHome,
    getEmployeeLeads,
    updateLeadTemperature,
    closeLead,
    scheduleAppointment,
    getEmployeeSchedule,
    updateEmployeeProfile,
    getEmployeeProfile,
    getEmployeeLeadsByStatus,
    getEmployeeScheduleByType,
    searchEmployeeLeads,
    searchEmployeeSchedule

};