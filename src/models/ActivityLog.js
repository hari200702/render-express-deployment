const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'performerModel'
    },
    performerModel: {
        type: String,
        required: true,
        enum: ['Admin', 'Employee']
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId
    },
    targetType: {
        type: String,
        enum: ['Lead', 'Employee', 'Admin', 'Attendance']
    },
    leadDetails: {
        name: String,
        email: String
    },
    employeeDetails: {
        id: mongoose.Schema.Types.ObjectId,
        name: String,
        email: String
    },
    previousData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    newData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false 
});

activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ performedBy: 1 });
activityLogSchema.index({ action: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);