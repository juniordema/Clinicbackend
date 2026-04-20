/**
 * Validateurs pour les données de l'application
 */

import { ValidationError } from '../utils/errors.js'

export const Validators = {
  /**
   * Valide un email
   */
  email: (email) => {
    if (!email) throw new ValidationError('Email requis.')
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(email)) {
      throw new ValidationError('Format d\'email invalide.')
    }
    return email.toLowerCase()
  },

  /**
   * Valide un numéro de téléphone
   */
  phone: (phone) => {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 8) {
      throw new ValidationError('Le numéro de téléphone doit contenir au moins 8 chiffres.')
    }
    return cleaned
  },

  /**
   * Valide un mot de passe
   */
  password: (password) => {
    if (!password) throw new ValidationError('Mot de passe requis.')
    if (password.length < 6) {
      throw new ValidationError('Le mot de passe doit contenir au moins 6 caractères.')
    }
    if (password.length > 128) {
      throw new ValidationError('Le mot de passe est trop long.')
    }
    return password
  },

  /**
   * Valide un nom (prénom ou nom)
   */
  name: (name, fieldName = 'Nom') => {
    if (!name || typeof name !== 'string') {
      throw new ValidationError(`${fieldName} requis.`)
    }
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      throw new ValidationError(`${fieldName} doit contenir au moins 2 caractères.`)
    }
    if (trimmed.length > 50) {
      throw new ValidationError(`${fieldName} est trop long.`)
    }
    return trimmed
  },

  /**
   * Valide une date (format YYYY-MM-DD)
   */
  date: (date, minDate = new Date()) => {
    if (!date) throw new ValidationError('Date requise.')
    
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(date)) {
      throw new ValidationError('Format de date invalide (YYYY-MM-DD).')
    }

    const d = new Date(date + 'T00:00:00')
    if (isNaN(d.getTime())) {
      throw new ValidationError('Date invalide.')
    }

    if (d < minDate) {
      throw new ValidationError('La date doit être dans le futur.')
    }

    return date
  },

  /**
   * Valide une heure (format HH:MM)
   */
  time: (time) => {
    if (!time) throw new ValidationError('Heure requise.')
    
    const regex = /^\d{2}:\d{2}$/
    if (!regex.test(time)) {
      throw new ValidationError('Format d\'heure invalide (HH:MM).')
    }

    const [h, m] = time.split(':').map(Number)
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      throw new ValidationError('Heure invalide.')
    }

    return time
  },

  /**
   * Valide un rôle utilisateur
   */
  role: (role) => {
    const validRoles = ['patient', 'doctor', 'admin']
    if (!validRoles.includes(role)) {
      throw new ValidationError(`Rôle invalide. Doit être: ${validRoles.join(', ')}.`)
    }
    return role
  },

  /**
   * Valide une note/texte
   */
  notes: (notes, maxLength = 1000) => {
    if (!notes) return ''
    if (typeof notes !== 'string') {
      throw new ValidationError('Les notes doivent être du texte.')
    }
    if (notes.length > maxLength) {
      throw new ValidationError(`Les notes ne peuvent pas dépasser ${maxLength} caractères.`)
    }
    return notes.trim()
  },

  /**
   * Valide un ID numérique
   */
  id: (id) => {
    const num = parseInt(id, 10)
    if (isNaN(num) || num < 1) {
      throw new ValidationError('ID invalide.')
    }
    return num
  }
}
