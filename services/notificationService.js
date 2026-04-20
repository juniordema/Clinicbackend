/**
 * Service Notifications - Gère les notifications DB et en temps réel
 */

import { db } from '../db.js'

export class NotificationService {
  /**
   * Crée une notification en base de données
   */
  static createNotification(userId, type, title, message, data = null) {
    const dataJson = data ? JSON.stringify(data) : null
    const result = db.prepare(`
      INSERT INTO notifications (userId, type, title, message, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, title, message, dataJson)
    return result.lastInsertRowid
  }

  /**
   * Notifie le médecin d'un nouveau rendez-vous
   */
  static async notifyDoctorNewAppointment(doctorUserId, { patientName, appointmentId, date, time, serviceName }) {
    const title = `Nouveau rendez-vous`
    const message = `${patientName} a pris un rendez-vous le ${date} à ${time} (${serviceName})`
    
    this.createNotification(doctorUserId, 'appointment_created', title, message, {
      appointmentId,
      patientName,
      date,
      time,
      serviceName
    })

    // TODO: Émettre via Socket.io pour notification temps réel
    console.log(`📢 Notification créée pour médecin ${doctorUserId}`)
  }

  /**
   * Notifie le médecin de l'annulation d'un rendez-vous
   */
  static async notifyDoctorAppointmentCancelled(doctorUserId, { appointmentId, patientName, date, time, serviceName }) {
    const title = `Rendez-vous annulé`
    const message = `${patientName} a annulé son rendez-vous du ${date} à ${time}${serviceName ? ` (${serviceName})` : ''}`

    this.createNotification(doctorUserId, 'appointment_cancelled', title, message, {
      appointmentId,
      patientName,
      date,
      time,
      serviceName
    })
  }

  /**
   * Notifie le patient de la confirmation d'un rendez-vous (par le médecin)
   */
  static async notifyPatientAppointmentConfirmed(patientUserId, { appointmentId, doctorName, date, time }) {
    const title = `Rendez-vous confirmé`
    const message = `Dr. ${doctorName} a confirmé votre rendez-vous du ${date} à ${time}`

    this.createNotification(patientUserId, 'appointment_confirmed', title, message, {
      appointmentId,
      doctorName,
      date,
      time
    })
  }

  /**
   * Notifie le patient du refus d'un rendez-vous
   */
  static async notifyPatientAppointmentRejected(patientUserId, { appointmentId, doctorName, date, time }) {
    const title = `Rendez-vous refusé`
    const message = `Dr. ${doctorName} a refusé votre rendez-vous du ${date} à ${time}`

    this.createNotification(patientUserId, 'appointment_rejected', title, message, {
      appointmentId,
      doctorName,
      date,
      time
    })
  }

  /**
   * Récupère les notifications d'un utilisateur
   */
  static getNotifications(userId, limit = 20, unreadOnly = false) {
    let query = 'SELECT * FROM notifications WHERE userId = ?'
    const params = [userId]

    if (unreadOnly) {
      query += ' AND isRead = 0'
    }

    query += ' ORDER BY createdAt DESC LIMIT ?'
    params.push(limit)

    const notifications = db.prepare(query).all(...params)

    return notifications.map((notification) => ({
      ...notification,
      data: notification.data ? JSON.parse(notification.data) : null
    }))
  }

  /**
   * Marque une notification comme lue
   */
  static markAsRead(notificationId) {
    db.prepare(
      "UPDATE notifications SET isRead = 1, readAt = datetime('now') WHERE id = ?"
    ).run(notificationId)
  }

  /**
   * Vérifie qu'une notification appartient à un utilisateur
   */
  static belongsToUser(notificationId, userId) {
    const notification = db.prepare(
      'SELECT id FROM notifications WHERE id = ? AND userId = ?'
    ).get(notificationId, userId)

    return !!notification
  }

  static getByIdForUser(notificationId, userId) {
    return db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND userId = ?'
    ).get(notificationId, userId)
  }

  /**
   * Marque toutes les notifications comme lues
   */
  static markAllAsRead(userId) {
    db.prepare(
      "UPDATE notifications SET isRead = 1, readAt = datetime('now') WHERE userId = ? AND isRead = 0"
    ).run(userId)
  }

  /**
   * Supprime une notification
   */
  static deleteNotification(notificationId) {
    db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId)
  }

  /**
   * Compte les notifications non lues
   */
  static getUnreadCount(userId) {
    return db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0'
    ).get(userId).count
  }
}
