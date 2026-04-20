/**
 * Planificateur de rappels — vérifie toutes les heures
 * les RDV à venir et envoie des emails de rappel 24h et 1h avant.
 */

import { db } from '../db.js'
import { MailerService } from './mailer.js'

export function startScheduler() {
  console.log('⏱️  Planificateur de rappels démarré')

  // Vérifier toutes les heures
  setInterval(async () => {
    try {
      await processReminders()
    } catch (err) {
      console.error('❌ Erreur scheduler:', err.message)
    }
  }, 60 * 60 * 1000) // toutes les heures

  // Lancer une première vérification immédiatement
  processReminders().catch(err => console.error('❌ Erreur première vérification:', err.message))
}

async function processReminders() {
  const now = new Date()

  // ─── Rappels 24h ───
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000)

  const due24h = db.prepare(`
    SELECT a.*, r.id as reminderId
    FROM appointments a
    LEFT JOIN reminders r ON r.appointmentId = a.id AND r.type = '24h'
    WHERE a.status IN ('pending', 'confirmed')
      AND r.id IS NULL
      AND datetime(a.date || 'T' || a.time) BETWEEN ? AND ?
  `).all(in23h.toISOString(), in24h.toISOString())

  for (const apt of due24h) {
    const email = apt.guestEmail || getUserEmail(apt.userId)
    const name = apt.guestName || getUserName(apt.userId)
    const doctorName = getDoctorName(apt.doctorId)

    if (email) {
      try {
        await MailerService.sendReminderEmail({
          to: email,
          name,
          doctorName,
          date: apt.date,
          time: apt.time,
          type: '24h'
        })
        
        db.prepare(`
          INSERT INTO reminders (appointmentId, type, status, sentAt)
          VALUES (?, '24h', 'sent', datetime('now'))
        `).run(apt.id)
        
        console.log(`📧 Rappel 24h envoyé → ${email}`)
      } catch (err) {
        console.error(`❌ Erreur rappel 24h pour ${apt.id}:`, err.message)
        db.prepare(`
          INSERT INTO reminders (appointmentId, type, status, failureReason)
          VALUES (?, '24h', 'failed', ?)
        `).run(apt.id, err.message)
      }
    }
  }

  // ─── Rappels 1h ───
  const in1h = new Date(now.getTime() + 60 * 60 * 1000)
  const in50mn = new Date(now.getTime() + 50 * 60 * 1000)

  const due1h = db.prepare(`
    SELECT a.*, r.id as reminderId
    FROM appointments a
    LEFT JOIN reminders r ON r.appointmentId = a.id AND r.type = '1h'
    WHERE a.status IN ('pending', 'confirmed')
      AND r.id IS NULL
      AND datetime(a.date || 'T' || a.time) BETWEEN ? AND ?
  `).all(in50mn.toISOString(), in1h.toISOString())

  for (const apt of due1h) {
    const email = apt.guestEmail || getUserEmail(apt.userId)
    const name = apt.guestName || getUserName(apt.userId)
    const doctorName = getDoctorName(apt.doctorId)

    if (email) {
      try {
        await MailerService.sendReminderEmail({
          to: email,
          name,
          doctorName,
          date: apt.date,
          time: apt.time,
          type: '1h'
        })
        
        db.prepare(`
          INSERT INTO reminders (appointmentId, type, status, sentAt)
          VALUES (?, '1h', 'sent', datetime('now'))
        `).run(apt.id)
        
        console.log(`📧 Rappel 1h envoyé → ${email}`)
      } catch (err) {
        console.error(`❌ Erreur rappel 1h pour ${apt.id}:`, err.message)
        db.prepare(`
          INSERT INTO reminders (appointmentId, type, status, failureReason)
          VALUES (?, '1h', 'failed', ?)
        `).run(apt.id, err.message)
      }
    }
  }
}

function getUserEmail(userId) {
  if (!userId) return null
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(userId)
  return u?.email || null
}

function getUserName(userId) {
  if (!userId) return 'Patient'
  const u = db.prepare('SELECT firstName FROM users WHERE id = ?').get(userId)
  return u?.firstName || 'Patient'
}

function getDoctorName(doctorId) {
  const u = db.prepare(`
    SELECT u.firstName, u.lastName FROM users u
    JOIN doctors d ON d.userId = u.id
    WHERE d.id = ?
  `).get(doctorId)
  return u ? `Dr. ${u.firstName} ${u.lastName}` : 'Dr. Médecin'
}
