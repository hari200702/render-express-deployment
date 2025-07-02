const jwt = require('jsonwebtoken');


const authenticateEmployee = async (req, res, next) => {
    try {
       
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        

        req.employeeId = decoded.employeeId;
        req.employeeEmail = decoded.email;
        req.role = decoded.role;
        

        if (req.role !== 'employee') {
            throw new Error();
        }
        
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Please authenticate as employee' 
        });
    }
};



const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '8h'
    });
};

module.exports = {
    authenticateEmployee,
    generateToken
};