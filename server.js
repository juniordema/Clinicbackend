import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import './db.js'
import { errorHandler } from './middleware/errorHandler.js'
import { startScheduler } from './services/scheduler.js'

// Routes
import authRoutes from './routes/auth.js'
import appointmentRoutes from './routes/appointments.js'
import doctorRoutes from './routes/doctors.js'
import slotsRoutes from './routes/slots.js'
import notificationRoutes from './routes/notifications.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.options('*', cors())
app.use(express.json())

// Routes API
app.use('/api/auth', authRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/doctors', doctorRoutes)
app.use('/api/slots', slotsRoutes)
app.use('/api/notifications', notificationRoutes)

// Health check
app.get('/api/health', (req, res) =>
  res.json({
    status: 'ok',
    message: 'Angelo Clinic API ✅',
    node: process.version,
    timestamp: new Date().toISOString()
  })
)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée.' })
})

// Middleware de gestion des erreurs (doit être en dernier)
app.use(errorHandler)

// Démarrer le planificateur de rappels
startScheduler()

app.listen(PORT, () => {
  console.log(`\n🚀  Serveur Angelo Clinic`)
  console.log(`📡  http://localhost:${PORT}/api/health`)
  console.log(`🔐  JWT Secret: ${process.env.JWT_SECRET ? '✓ Configuré' : '⚠️  À configurer'}\n`)
})
