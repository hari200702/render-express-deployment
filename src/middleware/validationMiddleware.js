const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validateEmployeeData = (req, res, next) => {
    const { firstName, lastName, email, location, languages } = req.body;
    const errors = [];

    if (!firstName || firstName.trim().length < 2) {
        errors.push('First name must be at least 2 characters');
    }

    if (!lastName || lastName.trim().length < 2) {
        errors.push('Last name must be at least 2 characters');
    }

    if (!email || !validateEmail(email)) {
        errors.push('Valid email is required');
    }

    if (!location || location.trim().length === 0) {
        errors.push('Location is required');
    }


    if (!languages || languages.trim().length === 0) {
        errors.push('At least one language is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

const validateLeadData = (req, res, next) => {
    const { appointmentDate } = req.body;

    if (appointmentDate) {
        const appointment = new Date(appointmentDate);
        const now = new Date();

        if (appointment < now) {
            return res.status(400).json({
                success: false,
                message: 'Appointment date must be in the future'
            });
        }
    }

    next();
};

module.exports = {
    validateEmail,
    validateEmployeeData,
    validateLeadData
};