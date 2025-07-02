const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Lead name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    phone: {
        type: String,
        trim: true
    },
    receivedDate: {
        type: Date,
        default: Date.now
    },
    location: {
        type: String,
        trim: true
    },
    language: {
        type: String,
        trim: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    assignedDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['hot', 'cold', 'warm'],
        default: 'warm',
        lowercase: true
    },
    leadStatus: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open',
        lowercase: true
    },
    appointment: {
        date: {
            type: Date
        },
        timeSlot: {
            type: String
        },
    },
    callType: {
        type: String,
        enum: ['referral', 'cold_call'],
        lowercase: true
    },
    closedDate: {
        type: Date
    },
    uploadBatchId: {
        type: String
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});


leadSchema.index({ assignedTo: 1, leadStatus: 1 });
leadSchema.index({ assignedDate: -1 });
leadSchema.index({ location: 1 });
leadSchema.index({ language: 1 });

module.exports = mongoose.model('Lead', leadSchema);