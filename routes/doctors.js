/**
 * Routes des médecins
 */

import express from 'express'
import { DoctorController } from '../controllers/doctorController.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// Routes protégées (médecin)
router.post('/profile', authMiddleware, requireRole('doctor'), asyncHandler(DoctorController.updateProfile))
router.get('/dashboard', authMiddleware, requireRole('doctor'), asyncHandler(DoctorController.getDashboard))
router.get('/appointments', authMiddleware, requireRole('doctor'), asyncHandler(DoctorController.getAppointments))
router.patch('/appointments/:id/confirm', authMiddleware, requireRole('doctor'), asyncHandler(DoctorController.confirmAppointment))
router.patch('/appointments/:id/reject', authMiddleware, requireRole('doctor'), asyncHandler(DoctorController.rejectAppointment))
router.patch('/appointments/:id/complete', authMiddleware, requireRole('doctor'), asyncHandler(DoctorController.completeAppointment))

// Routes publiques
router.get('/', asyncHandler(DoctorController.listAll))
router.get('/:id', asyncHandler(DoctorController.getById))

export default router
