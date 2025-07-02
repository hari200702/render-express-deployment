const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    breaks: [{
        startTime: {
            type: Date,
            required: true
        },
        endTime: {
            type: Date
        }
    }]
}, {
    timestamps: true
});

attendanceSchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);