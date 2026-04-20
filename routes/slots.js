/**
 * Routes des créneaux disponibles
 */

import express from 'express'
import { SlotsService } from '../services/slotsService.js'
import { Validators } from '../validators/validators.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'

const router = express.Router()

/**
 * GET /api/slots?doctorId=X&date=YYYY-MM-DD
 * Récupère les créneaux disponibles pour un médecin à une date donnée
 */
router.get('/', asyncHandler((req, res) => {
  const { doctorId, date } = req.query

  if (!doctorId || !date) {
    throw new ValidationError('doctorId et date requis.')
  }

  const validatedDoctorId = Validators.id(doctorId)
  const validatedDate = Validators.date(date, new Date(new Date().setDate(new Date().getDate() - 1)))

  const slots = SlotsService.getAvailableSlots(validatedDoctorId, validatedDate)
  res.json(slots)
}))

/**
 * GET /api/slots/week?doctorId=X&startDate=YYYY-MM-DD
 * Récupère la disponibilité pour une semaine
 */
router.get('/week', asyncHandler((req, res) => {
  const { doctorId, startDate } = req.query

  if (!doctorId || !startDate) {
    throw new ValidationError('doctorId et startDate requis.')
  }

  const validatedDoctorId = Validators.id(doctorId)
  const validatedStartDate = Validators.date(startDate, new Date(new Date().setDate(new Date().getDate() - 1)))

  const availability = SlotsService.getWeekAvailability(validatedDoctorId, validatedStartDate)
  res.json(availability)
}))

/**
 * POST /api/slots/check
 * Vérifie la disponibilité d'un créneau spécifique
 */
router.post('/check', asyncHandler((req, res) => {
  const { doctorId, date, time } = req.body

  if (!doctorId || !date || !time) {
    throw new ValidationError('doctorId, date et time requis.')
  }

  const validatedDoctorId = Validators.id(doctorId)
  const validatedDate = Validators.date(date)
  const validatedTime = Validators.time(time)

  const isAvailable = SlotsService.isSlotAvailable(validatedDoctorId, validatedDate, validatedTime)

  res.json({
    available: isAvailable,
    doctorId: validatedDoctorId,
    date: validatedDate,
    time: validatedTime
  })
}))

export default router

