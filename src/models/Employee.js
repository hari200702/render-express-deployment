const mongoose = require('mongoose');


const employeeSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    location: {
        type: String,
        required: [true, 'Location is required'],
        trim: true
    },
    languages: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        default: 'employee',
        immutable: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

employeeSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});


module.exports = mongoose.model('Employee', employeeSchema);