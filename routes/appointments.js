/**
 * Routes des rendez-vous
 */

import express from 'express'
import { AppointmentController } from '../controllers/appointmentController.js'
import { authMiddleware, optionalAuthMiddleware, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// Route publique : réservation sans compte
router.post('/guest', optionalAuthMiddleware, asyncHandler(AppointmentController.create))

// Routes protégées : rendez-vous pour patient connecté
router.use(authMiddleware)
router.use(requireRole('patient'))

router.get('/', asyncHandler(AppointmentController.getMyAppointments))
router.get('/:id', asyncHandler(AppointmentController.getById))
router.post('/', asyncHandler(AppointmentController.create))
router.patch('/:id', asyncHandler(AppointmentController.update))
router.patch('/:id/cancel', asyncHandler(AppointmentController.cancel))
router.delete('/:id', asyncHandler(AppointmentController.delete))

export default router
