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

import aiRoutes from './routes/aiRoutes.js';
import homeCareRoutes from './routes/homeCareRoutes.js';

const app = express();

// Configure trust proxy setting from environment (e.g. when behind TLS-terminator)
if (config.trustProxy) {
  app.set('trust proxy', config.trustProxy);
}

// Disable X-Powered-By header to prevent technology fingerprinting
app.disable('x-powered-by');

// Defense-in-depth HTTP security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';");

  // Enforce HSTS only when request is served over HTTPS or via trusted TLS-terminating proxy
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});

// Security and CORS middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      // Match configured client origin or local development ports
      const allowedOrigins = [
        config.clientOrigin,
        ...(config.nodeEnv !== 'production' ? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'] : [])
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

// Authenticated responses and sensitive request details must not enter shared caches.
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Logging middleware in development
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Public API greeting retains the /api prefix used by service routing.
app.get(['/', '/api'], (req, res) => {
  res.status(200).json({
    name: 'CARES Healthcare Navigation REST API',
    status: 'online',
    healthCheck: '/api/health',
    documentation: 'Milestone 1 Full-Stack Foundation'
  });
});

// Mount modular API routes
app.use('/api/ai', aiRoutes);
app.use('/api/home-care', homeCareRoutes);
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
