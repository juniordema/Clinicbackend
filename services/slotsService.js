/**
 * Service Créneaux - Gère la disponibilité des médecins
 */

import { db } from '../db.js'
import { Validators } from '../validators/validators.js'

export class SlotsService {
  /**
   * Récupère les créneaux disponibles pour un médecin à une date donnée
   */
  static getAvailableSlots(doctorId, date, slotDuration = 30) {
    const doctor = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId)
    if (!doctor) {
      throw new Error('Médecin non trouvé.')
    }

    // Récupérer les créneaux réservés (non annulés)
    const taken = db.prepare(
      `SELECT time FROM appointments WHERE doctorId = ? AND date = ? AND status != 'cancelled'`
    ).all(doctorId, date).map(r => r.time)

    // Générer tous les créneaux possibles (par défaut 30 min, 7h30 à 17h30)
    const allSlots = this.generateTimeSlots(slotDuration)

    // Filtrer les créneaux disponibles
    const available = allSlots.filter(time => !taken.includes(time))

    return {
      available,
      taken,
      total: allSlots.length,
      date,
      doctorId,
      slotDuration
    }
  }

  /**
   * Génère tous les créneaux horaires possibles
   */
  static generateTimeSlots(slotDuration = 30) {
    const slots = []
    const startHour = 7
    const startMinute = 30
    const endHour = 17
    const endMinute = 30

    let currentHour = startHour
    let currentMinute = startMinute

    while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
      slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`)
      
      currentMinute += slotDuration
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60)
        currentMinute = currentMinute % 60
      }
    }

    return slots
  }

  /**
   * Récupère les créneaux disponibles pour la semaine
   */
  static getWeekAvailability(doctorId, startDate, slotDuration = 30) {
    const doctor = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId)
    if (!doctor) {
      throw new Error('Médecin non trouvé.')
    }

    const startDateObj = new Date(startDate + 'T00:00:00')
    const availability = {}

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDateObj)
      currentDate.setDate(currentDate.getDate() + i)
      const dateStr = currentDate.toISOString().split('T')[0]

      const slots = this.getAvailableSlots(doctorId, dateStr, slotDuration)
      availability[dateStr] = slots.available
    }

    return availability
  }

  /**
   * Vérifie si un créneau spécifique est disponible
   */
  static isSlotAvailable(doctorId, date, time) {
    const appointment = db.prepare(
      `SELECT id FROM appointments WHERE doctorId = ? AND date = ? AND time = ? AND status != 'cancelled'`
    ).get(doctorId, date, time)

    return !appointment
  }

  /**
   * Vérifie la disponibilité d'un médecin (global)
   */
  static isDoctorAvailable(doctorId) {
    const doctor = db.prepare(
      'SELECT isAvailable FROM doctors WHERE id = ?'
    ).get(doctorId)

    return doctor && doctor.isAvailable
  }
}
