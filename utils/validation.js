/**
 * Validations backend - Email et Téléphone
 */

/**
 * Valide un email
 * @param {string} email
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email requis' }
  }

  email = email.trim()

  if (email.length > 254) {
    return { valid: false, error: 'Email trop long (max 254 caractères)' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Format d\'email invalide' }
  }

  // Vérifications supplémentaires
  if (email.startsWith('.') || email.endsWith('.')) {
    return { valid: false, error: 'Email invalide' }
  }

  if (email.includes('..')) {
    return { valid: false, error: 'Email invalide' }
  }

  const [localPart, domain] = email.split('@')

  if (localPart.length > 64) {
    return { valid: false, error: 'Partie locale de l\'email trop longue' }
  }

  if (domain.length < 3) {
    return { valid: false, error: 'Domaine invalide' }
  }

  return { valid: true, error: null }
}

/**
 * Valide un numéro de téléphone camerounais
 * Formats acceptés:
 * - +237 6XX XX XX XX
 * - +2376XXXXXXXXX
 * - 237XXXXXXXXX
 * - 06XXXXXXXXX
 * - 6XXXXXXXXX
 * @param {string} phone
 * @returns {{valid: boolean, error: string|null}}
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Téléphone requis' }
  }

  phone = phone.trim()

  // Nettoyer les espaces et caractères spéciaux
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')

  // Vérifier les opérateurs Cameroun (commence par 6, 7, 8, ou 9 après le +237 ou 0)
  const cameroonPhoneRegex = /^(\+237|237|0)?[6789]\d{8}$/

  if (!cameroonPhoneRegex.test(cleaned)) {
    return { valid: false, error: 'Format invalide. Utilisez: +237 6XX XX XX XX ou 06XX XX XX XX' }
  }

  // Vérifier la longueur finale (9-10 chiffres sans le +237 ou 0)
  const numberOnly = cleaned.replace(/^(\+237|237|0)/, '')

  if (numberOnly.length < 9 || numberOnly.length > 10) {
    return { valid: false, error: 'Longueur de numéro invalide' }
  }

  return { valid: true, error: null }
}

/**
 * Normalise un numéro de téléphone pour stockage en BD
 * Retourne le format: +237XXXXXXXXX
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return ''

  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')

  let normalized = cleaned

  // Convertir tous les formats en 237...
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    // 06XXXXXXXX → 237 6XXXXXXXX
    normalized = '237' + cleaned.substring(1)
  } else if (cleaned.startsWith('+237')) {
    normalized = cleaned.substring(1)
  } else if (cleaned.startsWith('237') && cleaned.length === 11) {
    normalized = cleaned
  } else if (!cleaned.startsWith('237') && cleaned.length === 9) {
    // 6XXXXXXXX → 237 6XXXXXXXX
    normalized = '237' + cleaned
  }

  return `+${normalized}`
}

/**
 * Valide toutes les données d'inscription
 * @param {Object} data - {firstName, lastName, email, phone, password}
 * @returns {{valid: boolean, errors: Object}}
 */
export function validateRegistration(data) {
  const errors = {}

  // Prénom
  if (!data.firstName?.trim()) {
    errors.firstName = 'Prénom requis'
  } else if (data.firstName.length < 2 || data.firstName.length > 50) {
    errors.firstName = 'Le prénom doit faire entre 2 et 50 caractères'
  }

  // Nom
  if (!data.lastName?.trim()) {
    errors.lastName = 'Nom requis'
  } else if (data.lastName.length < 2 || data.lastName.length > 50) {
    errors.lastName = 'Le nom doit faire entre 2 et 50 caractères'
  }

  // Email
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.valid) {
    errors.email = emailValidation.error
  }

  // Téléphone (optionnel)
  if (data.phone && data.phone.trim()) {
    const phoneValidation = validatePhone(data.phone)
    if (!phoneValidation.valid) {
      errors.phone = phoneValidation.error
    }
  }

  // Mot de passe
  if (!data.password) {
    errors.password = 'Mot de passe requis'
  } else if (data.password.length < 6) {
    errors.password = 'Le mot de passe doit faire au moins 6 caractères'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Valide les données de rendez-vous invité
 * @param {Object} data - {name, email, phone, ...}
 * @returns {{valid: boolean, errors: Object}}
 */
export function validateGuestAppointment(data) {
  const errors = {}

  // Nom
  if (!data.name?.trim()) {
    errors.name = 'Nom complet requis'
  } else if (data.name.length < 3 || data.name.length > 100) {
    errors.name = 'Le nom doit faire entre 3 et 100 caractères'
  }

  // Email
  const emailValidation = validateEmail(data.email)
  if (!emailValidation.valid) {
    errors.email = emailValidation.error
  }

  // Téléphone
  const phoneValidation = validatePhone(data.phone)
  if (!phoneValidation.valid) {
    errors.phone = phoneValidation.error
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}
