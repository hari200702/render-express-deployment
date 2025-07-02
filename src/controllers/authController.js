const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');
const { generateToken } = require('../middleware/authMiddleware');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const { logActivity, ACTIVITY_TYPES } = require('../utils/activitylogger');
const bcrypt = require('bcryptjs');


const employeeLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError('Please provide email and password', 400);
    }

    const employee = await Employee.findOne({ email });
    
    if (!employee) {
        throw new AppError('Invalid credentials', 401);
    }

    const isPasswordMatch = await bcrypt.compare(password, employee.password);
    
    if (!isPasswordMatch) {
        throw new AppError('Invalid Password', 401);
    }

    employee.lastLogin = new Date();
    employee.isActive = true;
    await employee.save();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
        employeeId: employee._id,
        date: today
    });

    if (!attendance) {
        attendance = await Attendance.create({
            employeeId: employee._id,
            date: today,
            checkIn: new Date(),
        });
    } else if (attendance.breaks.length > 0) {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        if (!lastBreak.endTime) {
            lastBreak.endTime = new Date();
            await attendance.save();
        }
    }

    const token = generateToken({
        employeeId: employee._id,
        email: employee.email,
        role: employee.role
    });

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            token,
            employee: {
                _id: employee._id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                role: employee.role
            }
        }
    });
});


const employeeLogout = asyncHandler(async (req, res) => {
    const { employeeId } = req;

    await Employee.findByIdAndUpdate(employeeId, { 
        isActive: false 
    });


    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
        employeeId: employeeId,
        date: today,
    });

    if (!attendance) {
        throw new AppError('No active attendance record found', 404);
    }

    attendance.breaks.push({
        startTime: new Date(),
        endTime: null
    });

    await attendance.save();

    res.json({
        success: true,
        message: 'Logged out successfully. Break started.'
    });
});

module.exports = {
    employeeLogin,
    employeeLogout
};