/**
 * Controller des médecins
 * Gère : profil médecin, tableau de bord, gestion rendez-vous
 */

import { db } from '../db.js'
import { Validators } from '../validators/validators.js'
import {
  ValidationError,
  NotFoundError,
  AuthorizationError
} from '../utils/errors.js'
import { NotificationService } from '../services/notificationService.js'
import { MailerService } from '../services/mailer.js'

export class DoctorController {
  /**
   * POST /api/doctors/profile - Créer/Mettre à jour le profil du médecin
   */
  static updateProfile(req, res) {
    const { specialization, bio, consultationFee } = req.body

    // Vérifier que le médecin existe
    const existing = db.prepare('SELECT id FROM doctors WHERE userId = ?').get(req.user.id)

    if (specialization || bio !== undefined || consultationFee !== undefined) {
      if (!specialization && !existing) {
        throw new ValidationError('Spécialité requise.')
      }

      const updates = {}

      if (specialization) {
        updates.specialization = Validators.name(specialization, 'Spécialité')
      }
      if (bio !== undefined) {
        updates.bio = Validators.notes(bio, 500)
      }
      if (consultationFee !== undefined) {
        if (consultationFee < 0) {
          throw new ValidationError('Les frais de consultation doivent être positifs.')
        }
        updates.consultationFee = parseFloat(consultationFee)
      }

      if (existing) {
        // Mise à jour
        updates.updatedAt = new Date().toISOString()
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
        const values = Object.values(updates)
        db.prepare(`UPDATE doctors SET ${fields} WHERE userId = ?`).run(...values, req.user.id)
      } else {
        // Création
        if (!specialization) {
          throw new ValidationError('Spécialité requise.')
        }
        db.prepare(
          `INSERT INTO doctors (userId, specialization, bio, consultationFee)
           VALUES (?, ?, ?, ?)`
        ).run(req.user.id, updates.specialization, updates.bio || '', updates.consultationFee || 0)
      }
    }

    const doctor = db.prepare(
      `SELECT d.*, u.firstName, u.lastName, u.email, u.phone
       FROM doctors d
       JOIN users u ON d.userId = u.id
       WHERE d.userId = ?`
    ).get(req.user.id)

    res.json({
      message: 'Profil médecin mis à jour.',
      doctor
    })
  }

  /**
   * GET /api/doctors/dashboard - Tableau de bord du médecin
   */
  static getDashboard(req, res) {
    const doctor = db.prepare('SELECT id FROM doctors WHERE userId = ?').get(req.user.id)
    if (!doctor) {
      throw new NotFoundError('Profil médecin non configuré.')
    }

    // Statistiques
    const today = new Date().toISOString().split('T')[0]
    
    const stats = {
      totalAppointments: db.prepare(
        'SELECT COUNT(*) as count FROM appointments WHERE doctorId = ?'
      ).get(doctor.id).count,
      
      pendingAppointments: db.prepare(
        'SELECT COUNT(*) as count FROM appointments WHERE doctorId = ? AND status = ?'
      ).get(doctor.id, 'pending').count,
      
      todayAppointments: db.prepare(
        'SELECT COUNT(*) as count FROM appointments WHERE doctorId = ? AND date = ?'
      ).get(doctor.id, today).count,
      
      completedAppointments: db.prepare(
        'SELECT COUNT(*) as count FROM appointments WHERE doctorId = ? AND status = ?'
      ).get(doctor.id, 'completed').count,
      
      cancelledAppointments: db.prepare(
        'SELECT COUNT(*) as count FROM appointments WHERE doctorId = ? AND status = ?'
      ).get(doctor.id, 'cancelled').count
    }

    // Rendez-vous de la journée
    const upcomingAppointments = db.prepare(`
      SELECT a.*, u.firstName, u.lastName, u.email, u.phone
      FROM appointments a
      LEFT JOIN users u ON a.userId = u.id
      WHERE a.doctorId = ? AND (a.date > ? OR (a.date = ? AND a.time > datetime('now')))
      AND a.status != 'cancelled'
      ORDER BY a.date ASC, a.time ASC
      LIMIT 10
    `).all(doctor.id, today, today)

    res.json({
      stats,
      upcomingAppointments
    })
  }

  /**
   * GET /api/doctors/appointments - Lister tous les rendez-vous du médecin
   */
  static getAppointments(req, res) {
    const { status, date, page = 1 } = req.query
    const doctor = db.prepare('SELECT id FROM doctors WHERE userId = ?').get(req.user.id)
    if (!doctor) {
      throw new NotFoundError('Profil médecin non configuré.')
    }

    let query = `
      SELECT a.*, u.firstName, u.lastName, u.email, u.phone
      FROM appointments a
      LEFT JOIN users u ON a.userId = u.id
      WHERE a.doctorId = ?
    `
    const params = [doctor.id]

    if (status) {
      query += ` AND a.status = ?`
      params.push(status)
    }

    if (date) {
      query += ` AND a.date = ?`
      params.push(date)
    }

    query += ` ORDER BY a.date DESC, a.time DESC`

    const appointments = db.prepare(query).all(...params)

    res.json(appointments)
  }

  /**
   * PATCH /api/doctors/appointments/:id/confirm - Confirmer un rendez-vous
   */
  static async confirmAppointment(req, res) {
    const appointmentId = Validators.id(req.params.id)

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)
    if (!appointment) {
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    // Vérifier que c'est le médecin assigné
    const doctor = db.prepare('SELECT id FROM doctors WHERE userId = ?').get(req.user.id)
    if (appointment.doctorId !== doctor.id) {
      throw new AuthorizationError()
    }

    if (appointment.status !== 'pending') {
      throw new ValidationError('Ce rendez-vous ne peut pas être confirmé.')
    }

    db.prepare("UPDATE appointments SET status = ?, updatedAt = datetime('now') WHERE id = ?")
      .run('confirmed', appointmentId)

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)
    const doctorUser = db.prepare('SELECT firstName, lastName FROM users WHERE id = ?').get(req.user.id)
    const doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`

    if (appointment.userId) {
      NotificationService.notifyPatientAppointmentConfirmed(appointment.userId, {
        appointmentId,
        doctorName,
        date: appointment.date,
        time: appointment.time
      })
    }

    const patientData = appointment.userId
      ? db.prepare('SELECT firstName, lastName, email FROM users WHERE id = ?').get(appointment.userId)
      : { firstName: appointment.guestName || 'Patient', lastName: '', email: appointment.guestEmail }

    if (patientData?.email) {
      await MailerService.sendAppointmentDecision({
        to: patientData.email,
        name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim() || 'Patient',
        doctorName,
        date: appointment.date,
        time: appointment.time,
        status: 'confirmed'
      }).catch(err => console.error('Patient decision email error:', err.message))
    }

    res.json({
      message: 'Rendez-vous confirmé.',
      appointment: updated
    })
  }

  /**
   * PATCH /api/doctors/appointments/:id/reject - Refuser un rendez-vous
   */
  static async rejectAppointment(req, res) {
    const appointmentId = Validators.id(req.params.id)
    const { doctorNotes } = req.body

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)
    if (!appointment) {
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    const doctor = db.prepare('SELECT id FROM doctors WHERE userId = ?').get(req.user.id)
    if (!doctor || appointment.doctorId !== doctor.id) {
      throw new AuthorizationError()
    }

    if (appointment.status !== 'pending') {
      throw new ValidationError('Seuls les rendez-vous en attente peuvent être refusés.')
    }

    const updates = {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    }

    if (doctorNotes) {
      updates.doctorNotes = Validators.notes(doctorNotes, 1000)
    }

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE appointments SET ${fields} WHERE id = ?`).run(...values, appointmentId)

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)
    const doctorUser = db.prepare('SELECT firstName, lastName FROM users WHERE id = ?').get(req.user.id)
    const doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`

    if (appointment.userId) {
      NotificationService.notifyPatientAppointmentRejected(appointment.userId, {
        appointmentId,
        doctorName,
        date: appointment.date,
        time: appointment.time
      })
    }

    const patientData = appointment.userId
      ? db.prepare('SELECT firstName, lastName, email FROM users WHERE id = ?').get(appointment.userId)
      : { firstName: appointment.guestName || 'Patient', lastName: '', email: appointment.guestEmail }

    if (patientData?.email) {
      await MailerService.sendAppointmentDecision({
        to: patientData.email,
        name: `${patientData.firstName || ''} ${patientData.lastName || ''}`.trim() || 'Patient',
        doctorName,
        date: appointment.date,
        time: appointment.time,
        status: 'rejected'
      }).catch(err => console.error('Patient rejection email error:', err.message))
    }

    res.json({
      message: 'Rendez-vous refusé.',
      appointment: updated
    })
  }

  /**
   * PATCH /api/doctors/appointments/:id/complete - Marquer comme complété
   */
  static completeAppointment(req, res) {
    const appointmentId = Validators.id(req.params.id)
    const { doctorNotes } = req.body

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)
    if (!appointment) {
      throw new NotFoundError('Rendez-vous non trouvé.')
    }

    const doctor = db.prepare('SELECT id FROM doctors WHERE userId = ?').get(req.user.id)
    if (appointment.doctorId !== doctor.id) {
      throw new AuthorizationError()
    }

    const updates = { status: 'completed', updatedAt: new Date().toISOString() }
    if (doctorNotes) {
      updates.doctorNotes = Validators.notes(doctorNotes, 1000)
    }

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)

    db.prepare(`UPDATE appointments SET ${fields} WHERE id = ?`).run(...values, appointmentId)

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId)

    res.json({
      message: 'Rendez-vous marqué comme complété.',
      appointment: updated
    })
  }

  /**
   * GET /api/doctors - Lister tous les médecins (public)
   */
  static listAll(req, res) {
    const doctors = db.prepare(`
      SELECT d.*, u.firstName, u.lastName, u.phone, u.email
      FROM doctors d
      JOIN users u ON d.userId = u.id
      WHERE u.isActive = 1 AND d.isAvailable = 1
      ORDER BY u.firstName ASC
    `).all()

    res.json(doctors)
  }

  /**
   * GET /api/doctors/:id - Obtenir les détails d'un médecin (public)
   */
  static getById(req, res) {
    const doctorId = Validators.id(req.params.id)

    const doctor = db.prepare(`
      SELECT d.*, u.firstName, u.lastName, u.phone, u.email
      FROM doctors d
      JOIN users u ON d.userId = u.id
      WHERE d.id = ? AND u.isActive = 1
    `).get(doctorId)

    if (!doctor) {
      throw new NotFoundError('Médecin non trouvé.')
    }

    res.json(doctor)
  }
}
