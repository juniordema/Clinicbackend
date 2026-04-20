/**
 * Controller des rendez-vous
 * Gère : création, lecture, modification, annulation, confirmation
 */

import { db } from '../db.js'
import { Validators } from '../validators/validators.js'
import { validateEmail, validatePhone, normalizePhone, validateGuestAppointment } from '../utils/validation.js'
import {
  ValidationError,
  NotFoundError,
  ConflictError
} from '../utils/errors.js'
import { NotificationService } from '../services/notificationService.js'
import { MailerService } from '../services/mailer.js'
import { SlotsService } from '../services/slotsService.js'
import { AuditService } from '../services/auditService.js'

export class AppointmentController {
  static getOwnedAppointmentById(appointmentId, user) {
    const userEmail = user?.email ?? null
    return db.prepare(
      `SELECT * FROM appointments
       WHERE id = ?
         AND (
           userId = ?
           OR (userId IS NULL AND guestEmail = ? COLLATE NOCASE)
         )`
    ).get(appointmentId, user.id, userEmail)
  }

  /**
   * POST /api/appointments - Créer un rendez-vous (patient ou invité)
   */
  static async create(req, res) {
    const { doctorId, serviceName, date, time, notes, guestName, guestPhone, guestEmail } = req.body

    // Validations
    const validatedDoctorId = Validators.id(doctorId)
    const validatedDate = Validators.date(date)
    const validatedTime = Validators.time(time)
    const validatedNotes = Validators.notes(notes || '')

    // Vérifier que le médecin existe
    const doctor = db.prepare('SELECT id, userId FROM doctors WHERE id = ?').get(validatedDoctorId)
    if (!doctor) {
      throw new NotFoundError('Médecin non trouvé.')
    }
    if (!SlotsService.isDoctorAvailable(validatedDoctorId)) {
      throw new ValidationError('Ce médecin n\'accepte pas de rendez-vous pour le moment.')
    }

    if (!SlotsService.isSlotAvailable(validatedDoctorId, validatedDate, validatedTime)) {
      throw new ConflictError('Ce créneau n\'est pas disponible. Veuillez choisir une autre heure.')
    }

    let userId = null
    let finalGuestName = null
    let finalGuestEmail = null
    let finalGuestPhone = null

    if (req.user) {
      // Patient connecté
      userId = req.user.id
    } else {
      // Utilisateur sans compte - valider les données STRICTEMENT
      const guestValidation = validateGuestAppointment({ name: guestName, email: guestEmail, phone: guestPhone })
      if (!guestValidation.valid) {
        throw new ValidationError('Erreurs de validation', guestValidation.errors)
      }

      // Validation supplémentaire stricte
      const emailValidation = validateEmail(guestEmail)
      if (!emailValidation.valid) {
        throw new ValidationError(emailValidation.error)
      }

      const phoneValidation = validatePhone(guestPhone)
      if (!phoneValidation.valid) {
        throw new ValidationError(phoneValidation.error)
      }

      finalGuestName = Validators.name(guestName || '', 'Nom du patient')
      finalGuestEmail = guestEmail
      finalGuestPhone = normalizePhone(guestPhone)
    }

    // Créer le rendez-vous
    const result = db.prepare(`
      INSERT INTO appointments (
        userId, doctorId, serviceName, date, time, notes,
        guestName, guestEmail, guestPhone, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      userId, validatedDoctorId, serviceName, validatedDate, validatedTime, validatedNotes,
      finalGuestName, finalGuestEmail, finalGuestPhone
    )

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid)

    // Récupérer les infos du patient
    let patientName, patientEmail
    if (userId) {
      const user = db.prepare('SELECT firstName, lastName, email FROM users WHERE id = ?').get(userId)
      patientName = `${user.firstName} ${user.lastName}`
      patientEmail = user.email
    } else {
      patientName = finalGuestName
      patientEmail = finalGuestEmail
    }

    // Récupérer les infos du médecin
    const doctorUser = db.prepare('SELECT firstName, lastName, email FROM users WHERE id = ?').get(doctor.userId)
    const doctorName = `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`

    // Envoyer une notification au médecin (email + DB)
    await NotificationService.notifyDoctorNewAppointment(doctor.userId, {
      patientName,
      appointmentId: appointment.id,
      date: appointment.date,
      time: appointment.time,
      serviceName: appointment.serviceName
    })

    // Envoyer un email de notification au médecin pour notification immédiate
    await MailerService.sendDoctorNotification({
      to: doctorUser.email,
      doctorName: `${doctorUser.firstName} ${doctorUser.lastName}`,
      patientName,
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: appointment.time,
      appointmentId: appointment.id
    }).catch(err => console.error('Doctor email notification error:', err.message))

    // Envoyer email de confirmation au patient
    if (patientEmail) {
      await MailerService.sendAppointmentConfirmation({
        to: patientEmail,
        name: patientName,
        doctorName,
        serviceName: appointment.serviceName,
        date: appointment.date,
        time: appointment.time,
        appointmentId: appointment.id
      }).catch(err => console.error('Email error:', err.message))
    }

    res.status(201).json({
      message: 'Rendez-vous créé avec succès.',
      appointment
    })
  }

  /**
   * GET /api/appointments - Lister les rendez-vous de l'utilisateur
   */
  static getMyAppointments(req, res) {
    const userEmail = req.user.email ?? null
    const appointments = db.prepare(`
      SELECT a.*, d.id as docId, u.firstName, u.lastName,
             ('Dr. ' || u.firstName || ' ' || u.lastName) as doctorName
      FROM appointments a
      JOIN doctors d ON a.doctorId = d.id
      JOIN users u ON d.userId = u.id
      WHERE a.userId = ?
         OR (a.userId IS NULL AND a.guestEmail = ? COLLATE NOCASE)
      ORDER BY a.date ASC, a.time ASC
    `).all(req.user.id, userEmail)

    res.json(appointments)
  }

  /**
   * GET /api/appointments/:id - Obtenir les détails d'un rendez-vous
   */
  static getById(req, res) {
    const appointmentId = Validators.id(req.params.id)
    const userEmail = req.user.email ?? null

    const appointment = db.prepare(`
      SELECT a.*, d.id as docId, u.firstName, u.lastName, u.email
      FROM appointments a
      JOIN doctors d ON a.doctorId = d.id
      JOIN users u ON d.userId = u.id
      WHERE a.id = ?
        AND (
          a.userId = ?
          OR (a.userId IS NULL AND a.guestEmail = ? COLLATE NOCASE)
        )
    `).get(appointmentId, req.user.id, userEmail)

    if (!appointment) {
      AuditService.log(req.user.id, 'appointment_access_denied', 'appointment', appointmentId, {
        route: 'GET /api/appointments/:id'
      })
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    res.json(appointment)
  }

  /**
   * PATCH /api/appointments/:id - Modifier un rendez-vous (date/heure/notes)
   */
  static async update(req, res) {
    const appointmentId = Validators.id(req.params.id)
    const { date, time, notes } = req.body

    const appointment = this.getOwnedAppointmentById(appointmentId, req.user)
    if (!appointment) {
      AuditService.log(req.user.id, 'appointment_access_denied', 'appointment', appointmentId, {
        route: 'PATCH /api/appointments/:id'
      })
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
      throw new ValidationError('Ce rendez-vous ne peut plus être modifié.')
    }

    const updates = {}

    if (date) {
      updates.date = Validators.date(date)
      
      // Vérifier la disponibilité avec la nouvelle date
      const conflict = db.prepare(
        `SELECT id FROM appointments 
         WHERE doctorId = ? AND date = ? AND time = ? AND id != ? AND status != 'cancelled'`
      ).get(appointment.doctorId, updates.date, time || appointment.time, appointmentId)
      
      if (conflict) {
        throw new ConflictError('Ce créneau n\'est pas disponible.')
      }
    }

    if (time) {
      updates.time = Validators.time(time)
    }

    if (notes !== undefined) {
      updates.notes = Validators.notes(notes || '')
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('Aucune donnée à mettre à jour.')
    }

    updates.updatedAt = new Date().toISOString()

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)

    db.prepare(`UPDATE appointments SET ${fields} WHERE id = ?`).run(...values, appointmentId)

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)

    res.json({
      message: 'Rendez-vous modifié.',
      appointment: updated
    })
  }

  /**
   * PATCH /api/appointments/:id/cancel - Annuler un rendez-vous
   */
  static async cancel(req, res) {
    const appointmentId = Validators.id(req.params.id)

    const appointment = this.getOwnedAppointmentById(appointmentId, req.user)
    if (!appointment) {
      AuditService.log(req.user.id, 'appointment_access_denied', 'appointment', appointmentId, {
        route: 'PATCH /api/appointments/:id/cancel'
      })
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    if (appointment.status === 'cancelled') {
      throw new ValidationError('Ce rendez-vous est déjà annulé.')
    }

    if (appointment.status === 'completed') {
      throw new ValidationError('Un rendez-vous complété ne peut pas être annulé.')
    }

    db.prepare("UPDATE appointments SET status = ?, updatedAt = datetime('now') WHERE id = ?")
      .run('cancelled', appointmentId)

    // Notifier le médecin
    const doctor = db.prepare('SELECT userId FROM doctors WHERE id = ?').get(appointment.doctorId)
    if (doctor) {
      const patient = db.prepare('SELECT firstName, lastName FROM users WHERE id = ?').get(req.user.id)
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Un patient'
      await NotificationService.notifyDoctorAppointmentCancelled(doctor.userId, {
        appointmentId,
        patientName,
        date: appointment.date,
        time: appointment.time,
        serviceName: appointment.serviceName
      })
    }

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)

    res.json({
      message: 'Rendez-vous annulé.',
      appointment: updated
    })
  }

  /**
   * DELETE /api/appointments/:id - Supprimer un rendez-vous
   */
  static delete(req, res) {
    const appointmentId = Validators.id(req.params.id)

    const appointment = this.getOwnedAppointmentById(appointmentId, req.user)
    if (!appointment) {
      AuditService.log(req.user.id, 'appointment_access_denied', 'appointment', appointmentId, {
        route: 'DELETE /api/appointments/:id'
      })
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    db.prepare('DELETE FROM appointments WHERE id = ?').run(appointmentId)

    res.json({ message: 'Rendez-vous supprimé.' })
  }
}
