const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const Lead = require('../models/Lead');
const ActivityLog = require('../models/ActivityLog');
const bcrypt = require('bcryptjs');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const { parseLeadCSV } = require("../utils/csvParser")
const { 
    assignLeadsToEmployees, 
    assignUnassignedLeadsToNewEmployee,
    reassignLeadsOnEmployeeDeletion 
} = require('../utils/leadAssignment');
const { logActivity , ACTIVITY_TYPES }= require("../utils/activitylogger")
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const getDashboard = asyncHandler(async (req, res) => {
    
  const now = new Date();
    
    const weekStart = new Date(now);
    const daysSinceSunday = now.getDay(); 
    weekStart.setDate(now.getDate() - daysSinceSunday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    


    const [
        unassignedLeads,
        assignedThisWeek,
        activeSalespeople,
        totalLeads,
        closedLeads,
        dailyClosedData,
        recentActivities,
        employeeTableData
    ] = await Promise.all([
        Lead.countDocuments({ assignedTo: null, leadStatus: 'open' }),
        
        Lead.countDocuments({
            assignedDate: { $gte: weekStart, $lte: weekEnd },
            assignedTo: { $ne: null }
        }),
        
        Employee.countDocuments({ isActive: true }),
        
        Lead.countDocuments({}),
       
        
        Lead.countDocuments({ leadStatus: 'closed' }),
        

        getDailyClosedDeals(10),
        

        getRecentActivities(2),


        getEmployeeTableData(5)
    ]);

    const conversionRate = totalLeads > 0 
        ? Math.round((closedLeads / totalLeads) * 100) 
        : 0;

    res.json({
        success: true,
        data: {
            metrics: {
                unassignedLeads,
                assignedThisWeek,
                activeSalespeople,
                conversionRate
            },
            salesAnalytics: dailyClosedData,
            recentActivities,
            employeeTable: employeeTableData
        }
    });
});

const getProfile = asyncHandler(async (req, res) => {
    const admin = await Admin.findOne();

    
    if (!admin) {
        throw new AppError('Admin profile not found', 404);
    }

    res.json({
        success: true,
        data: {
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
        }
    });
});

const updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    
    const admin = await Admin.findOne();
    
    if (!admin) {
        throw new AppError('Admin profile not found', 404);
    }

    const updates = [];

    if (firstName && firstName !== admin.firstName) {
        admin.firstName = firstName;
        updates.push('firstName');
    }
    
    if (lastName && lastName !== admin.lastName) {
        admin.lastName = lastName;
        updates.push('lastName');
    }
    
    if (email && email !== admin.email) {
        if (!validateEmail(email)) {
            throw new AppError('Invalid email format', 400);
        }
        admin.email = email;
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
        
        admin.password = await bcrypt.hash(password, 10);
        updates.push('password');
    }

    if (updates.length > 0) {
        await admin.save();
    
    }

    res.json({
        success: true,
        message: updates.length > 0 ? 
            `Profile updated successfully. Updated: ${updates.join(', ')}` : 
            'No changes made',
        data: {
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email
        }
    });
});


const upload = multer({ 
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new AppError('Only CSV files are allowed', 400), false);
        }
    }
});

const uploadLeads = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError('Please upload a CSV file', 400);
    }

    const csvData = [];
    
    await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (row) => {
                csvData.push(row);
            })
            .on('end', () => {
                fs.unlinkSync(req.file.path);
                resolve();
            })
            .on('error', reject);
    });

    if (!csvData || csvData.length === 0) {
        throw new AppError('CSV file is empty', 400);
    }

    const admin = await Admin.findOne();

    const { leads, errors, summary } = parseLeadCSV(csvData);
    
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'CSV validation errors',
            errors,
            summary
        });
    }

    const batchId = `batch_${Date.now()}`;
    leads.forEach(lead => {
        lead.uploadedBy = admin._id;
        lead.uploadBatchId = batchId;
    });

    const savedLeads = await Lead.insertMany(leads);

    const employees = await Employee.find();

    const assignmentResult = await assignLeadsToEmployees(savedLeads, employees);


    for (const assignment of assignmentResult.assignments) {
        if (assignment.assignedTo) {
            await Lead.findByIdAndUpdate(assignment.leadId, {
                assignedTo: assignment.assignedTo,
                assignedDate: new Date()
            });

            await logActivity(ActivityLog, {
            action: ACTIVITY_TYPES.LEAD_ASSIGNED,
            performedBy: admin._id,
            performerModel: 'Admin',
            targetId:assignment.assignedTo,
            targetType:'Employee',
            employeeDetails:{
                id:assignment.assignedTo,
                name:assignment.employeeName
            },
    });

        }
    }


    

    res.json({
        success: true,
        message: 'CSV uploaded successfully',
        data: {
            batchId,
            summary: assignmentResult.summary,
            assignments: assignmentResult.assignments
        }
    });
});

const getLeads = asyncHandler(async (req, res) => {
    const leads = await Lead.find()
        .populate('assignedTo', 'firstName lastName email')
        .sort({ createdAt: -1 });

    const formattedLeads = leads.map(lead => {
        const formattedDate = lead.receivedDate
            ? new Date(lead.receivedDate).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: '2-digit',
                timeZone: 'Asia/Kolkata'
              })
            : 'N/A';

        return {
            _id: lead._id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            receivedDate: formattedDate,
            leadStatus: lead.leadStatus,
            assignedEmployee: lead.assignedTo
                ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
                : 'Unassigned',

        };
    });

    res.json({
        success: true,
        count: formattedLeads.length,
        data: formattedLeads
    });
});

const getEmployees = asyncHandler(async (req, res) => {
    const employees = await Employee.find()
        .select('-password')
        .sort({ createdAt: -1 });

    const employeesWithStats = await Promise.all(
        employees.map(async (employee) => {
            const [assignedLeads, closedLeads] = await Promise.all([
                Lead.countDocuments({ 
                    assignedTo: employee._id
                }),
                Lead.countDocuments({ 
                    assignedTo: employee._id, 
                    leadStatus: 'closed' 
                })
            ]);

            return {
                _id: employee._id,
                name: `${employee.firstName} ${employee.lastName}`,
                email: employee.email,
                employeeId: `#${employee._id.toString().slice(-8).toUpperCase()}`,
                assignedLeads,
                closedLeads,
                status: employee.isActive ? 'Active' : 'Deactive',
                location:employee.location,
                language:employee.languages
            };
        })
    );



    res.json({
        success: true,
        count: employees.length,
        data: employeesWithStats
    });
});

const createEmployee = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, location, languages } = req.body;
    
    const admin = await Admin.findOne();
    
    const defaultPassword = await bcrypt.hash(email.split('@')[0],10);

    defaultPassword
    
    const employee = await Employee.create({
        firstName,
        lastName,
        email,
        password: defaultPassword, 
        location,
        languages,
        createdBy: admin._id
    });

    const unassignedLeads = await Lead.find({ 
        assignedTo: null,
        leadStatus: 'open'
    });

    let assignmentResult = null;
    if (unassignedLeads.length > 0) {
        assignmentResult = await assignUnassignedLeadsToNewEmployee(employee, unassignedLeads);
        
        for (const assignment of assignmentResult.assignments) {
            if(assignment.assignedTo){
                await Lead.findByIdAndUpdate(assignment.leadId, {
                assignedTo: assignment.assignedTo,
                assignedDate: new Date()
            });

            await logActivity(ActivityLog, {
                action: ACTIVITY_TYPES.LEAD_ASSIGNED,
                performedBy: admin._id,
                performerModel: 'Admin',
                targetId: assignment.assignedTo,
                targetType: 'Employee',
                employeeDetails: {
                    id: assignment.assignedTo,
                    name: assignment.employeeName
      }
    });

            }
            
        }
    }

    

    res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: {
            employee: {
                _id: employee._id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                location: employee.location,
                languages: employee.languages,
                isActive: employee.isActive,
                defaultPassword: defaultPassword
            },
            assignmentSummary: assignmentResult?.summary || null
        }
    });
});
const updateEmployee = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
        throw new AppError('Employee not found', 404);
    }

    const emailChanged = email && email !== employee.email;

    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    
    if (emailChanged) {
        const existingEmployee = await Employee.findOne({ email, _id: { $ne: id } });
        if (existingEmployee) {
            throw new AppError('Email already in use', 400);
        }
        
        employee.email = email;
        employee.password = email.split('@')[0];
    }

    await employee.save();

    const admin = await Admin.findOne();


    


    res.json({
        success: true,
        message: emailChanged ? 
            'Employee updated successfully. Password has been reset to email prefix.' : 
            'Employee updated successfully',
        data: {
            _id: employee._id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            ...(emailChanged && { passwordHint: `Password is now: ${email.split('@')[0]}` })
        }
    });
});

const deleteEmployee = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const employee = await Employee.findById(id);
    if (!employee) {
        throw new AppError('Employee not found', 404);
    }

    const admin = await Admin.findOne();

    const openLeads = await Lead.find({
        assignedTo: id,
        leadStatus: 'open'
    });

    employee.isActive = false;
    await employee.save();

    let reassignmentResult = null;
    if (openLeads.length > 0) {
        const activeEmployees = await Employee.find({
            _id: { $ne: id }
        });

        reassignmentResult = await reassignLeadsOnEmployeeDeletion(openLeads, activeEmployees);


        for (const assignment of reassignmentResult.assignments) {
            await Lead.findByIdAndUpdate(assignment.leadId, {
                assignedTo: assignment.assignedTo,
                assignedDate: assignment.assignedTo ? new Date() : null
            });

            if (assignment.assignedTo) {
                await logActivity(ActivityLog, {
                    action: ACTIVITY_TYPES.LEAD_ASSIGNED,
                    performedBy: admin._id,
                    performerModel: 'Admin',
                    targetId: assignment.assignedTo,
                    targetType: 'Employee',
                    employeeDetails: {
                        id: assignment.assignedTo,
                        name: assignment.employeeName
                }
            })
        };
        }
    }

    await Employee.findByIdAndDelete(id);



    res.json({
        success: true,
        message: 'Employee deleted successfully',
        data: {
            deletedEmployee: employee.email,
            reassignmentSummary: reassignmentResult?.summary || {
                totalLeads: 0,
                reassigned: 0,
                unassigned: 0
            }
        }
    });
});

// Helper functions
async function getEmployeeTableData(limit = 10) {
    const employees = await Employee.find({ isActive: true })
        .select('firstName lastName email')
        .limit(limit)
        .sort({ createdAt: -1 });

    const employeesWithStats = await Promise.all(
        employees.map(async (employee) => {
            const [assignedLeads, closedLeads] = await Promise.all([
                Lead.countDocuments({ 
                    assignedTo: employee._id
                }),
                Lead.countDocuments({ 
                    assignedTo: employee._id, 
                    leadStatus: 'closed' 
                })
            ]);

            return {
                _id: employee._id,
                name: `${employee.firstName} ${employee.lastName}`,
                email: employee.email,
                employeeId: `#${employee._id.toString().slice(-8).toUpperCase()}`, 
                assignedLeads,
                closedLeads,
                status: 'Active' 
            };
        })
    );

    return employeesWithStats;
}



async function getDailyClosedDeals(days) {
    const results = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999); 

    for (let i = days - 1; i >= 0; i--) {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - i);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);


        const count = await Lead.countDocuments({
            leadStatus: 'closed',
            closedDate: {
                $gte: startDate,
                $lte: endDate
            }
        });

        results.push({
            date: startDate.toLocaleDateString('en-US', { weekday: 'short' }),
            count
        });
    }

    return results;
}

async function getRecentActivities(limit) {
    const activities = await ActivityLog.find({
        action: {
            $in: [
                ACTIVITY_TYPES.LEAD_ASSIGNED,     
                ACTIVITY_TYPES.LEAD_CLOSED
            ]
        }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy', 'firstName lastName');

    return activities.map(activity => {
        const timeAgo = getTimeAgo(activity.timestamp);
        let message = '';

        switch (activity.action) {
            case ACTIVITY_TYPES.LEAD_ASSIGNED: 
                message = `You assigned a lead to ${activity.employeeDetails?.name || 'an employee'}`;
                break;
            case ACTIVITY_TYPES.LEAD_CLOSED:    
                message = `${activity.employeeDetails?.name || 'An employee'} closed a deal`;
                break;
        }

        return {
            message,
            timeAgo,
            timestamp: activity.timestamp
        };
    });
}

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

const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

module.exports = {
    getDashboard,
    getProfile,
    updateProfile,
    uploadLeads,
    getLeads,
    getEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
};