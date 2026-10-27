import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';

// Route handlers
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import hospitalRoutes from './routes/hospitalRoutes.js';
import publicHospitalRoutes from './routes/publicHospitalRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// Security and CORS middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // Match configured client origin or local development ports
      const allowedOrigins = [
        config.clientOrigin,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000'
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging middleware in development
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Root greeting / health redirect
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'CARES Healthcare Navigation REST API',
    status: 'online',
    healthCheck: '/api/health',
    documentation: 'Milestone 1 Full-Stack Foundation'
  });
});

// Mount modular API routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/doctor', doctorRoutes); // Doctor portal dashboard
app.use('/api/patient', patientRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/hospitals', publicHospitalRoutes);
app.use('/api/admin', adminRoutes);

// Handle 404 for unknown endpoints
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

export default app;
