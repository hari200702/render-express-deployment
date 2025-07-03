
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const dotenv = require('dotenv');

dotenv.config()

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes')
const employeeRoutes = require('./routes/employeeRoutes')
const { errorHandler }= require('./middleware/errorMiddleware')


const app = express()




app.use(cors({
  origin: ['https://canvocrmmobile.netlify.app','https://canvocrm.netlify.app','http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json())
app.use(express.urlencoded({ extended : true }))

app.use((req,res,next)=>{
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
})

app.get('/',(req,res)=>{
    res.json({
        message: 'CRM API',
    })
})

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);

app.use(errorHandler);


const MONGODB_URI = process.env.MONGODB_URI;



mongoose.connect(process.env.MONGODB_URI)
.then(()=>{
    console.log(" Connectedd To Server ")

    const PORT = process.env.PORT || 5000;
    app.listen(PORT,()=>{
        console.log(`  Server running on port ${PORT} `)
        console.log(` Environment: ${process.env.NODE_ENV}`);
    })
})


.catch(error=>{
    console.error('MongoDB connection error:', error);
    process.exit(1);
})

process.on('unhandledRejection', (err)=>{
    console.error('UNHANDLED REJECTION!  Shutting down...');
    console.error(err);
    process.exit(1);
})
