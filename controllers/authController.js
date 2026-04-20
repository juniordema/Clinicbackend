/**
 * Controller d'authentification
 * Gère : inscription, connexion, profil, déconnexion
 */

import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { generateToken } from '../middleware/auth.js'
import { Validators } from '../validators/validators.js'
import { validateEmail, validatePhone, normalizePhone, validateRegistration } from '../utils/validation.js'
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError
} from '../utils/errors.js'

export class AuthController {
  /**
   * POST /api/auth/register - Enregistrement d'un nouvel utilisateur
   */
  static async register(req, res) {
    const { firstName, lastName, email, phone, password, confirmPassword } = req.body
    const role = 'patient'

    // Validation stricte des données
    const validation = validateRegistration({ firstName, lastName, email, phone, password })
    if (!validation.valid) {
      throw new ValidationError('Erreurs de validation', validation.errors)
    }

    // Email stricte
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      throw new ValidationError(emailValidation.error)
    }

    // Téléphone stricte (si fourni)
    if (phone && phone.trim()) {
      const phoneValidation = validatePhone(phone)
      if (!phoneValidation.valid) {
        throw new ValidationError(phoneValidation.error)
      }
    }

    const validatedFirstName = Validators.name(firstName, 'Prénom')
    const validatedLastName = Validators.name(lastName, 'Nom')
    const validatedPassword = Validators.password(password)
    Validators.role(role)

    if (confirmPassword && password !== confirmPassword) {
      throw new ValidationError('Les mots de passe ne correspondent pas.')
    }

    // Vérifier si l'email existe déjà
    const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email.toLowerCase())
    if (existing) {
      throw new ConflictError('Un compte avec cet email existe déjà.')
    }

    // Normaliser le téléphone
    const normalizedPhone = phone ? normalizePhone(phone) : ''

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(validatedPassword, 10)

    // Créer l'utilisateur
    const result = db.prepare(
      `INSERT INTO users (firstName, lastName, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(validatedFirstName, validatedLastName, email.toLowerCase(), normalizedPhone, hashedPassword, role)

    const user = {
      id: result.lastInsertRowid,
      firstName: validatedFirstName,
      lastName: validatedLastName,
      email: email.toLowerCase(),
      phone: normalizedPhone,
      role
    }

    res.status(201).json({
      message: 'Inscription réussie.',
      token: generateToken(user),
      user
    })
  }

  /**
   * POST /api/auth/login - Connexion utilisateur
   */
  static async login(req, res) {
    const { email, password } = req.body

    if (!email || !password) {
      throw new ValidationError('Email et mot de passe requis.')
    }

    // Validation stricte de l'email
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      throw new ValidationError(emailValidation.error)
    }

    // Chercher l'utilisateur
    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email.toLowerCase())
    if (!user) {
      throw new AuthenticationError('Email ou mot de passe incorrect.')
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new AuthenticationError('Email ou mot de passe incorrect.')
    }

    if (!user.isActive) {
      throw new AuthenticationError('Votre compte a été désactivé.')
    }

    const publicUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role
    }

    res.json({
      message: 'Connexion réussie.',
      token: generateToken(publicUser),
      user: publicUser
    })
  }

  /**
   * GET /api/auth/me - Obtenir le profil de l'utilisateur connecté
   */
  static getProfile(req, res) {
    const user = db.prepare('SELECT id, firstName, lastName, email, phone, role, createdAt FROM users WHERE id = ?').get(req.user.id)
    
    if (!user) {
      throw new NotFoundError('Utilisateur non trouvé.')
    }

    res.json(user)
  }

  /**
   * PATCH /api/auth/me - Mettre à jour le profil
   */
  static async updateProfile(req, res) {
    const { firstName, lastName, phone } = req.body
    const updates = {}

    if (firstName) {
      updates.firstName = Validators.name(firstName, 'Prénom')
    }
    if (lastName) {
      updates.lastName = Validators.name(lastName, 'Nom')
    }
    if (phone !== undefined) {
      updates.phone = Validators.phone(phone || '')
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('Aucune donnée à mettre à jour.')
    }

    updates.updatedAt = new Date().toISOString()

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)

    db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values, req.user.id)

    const user = db.prepare(
      'SELECT id, firstName, lastName, email, phone, role, createdAt, updatedAt FROM users WHERE id = ?'
    ).get(req.user.id)

    res.json({
      message: 'Profil mis à jour.',
      user
    })
  }

  /**
   * POST /api/auth/change-password - Changer le mot de passe
   */
  static async changePassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Ancien mot de passe et nouveau mot de passe requis.')
    }

    // Vérifier l'ancien mot de passe
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id)
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      throw new AuthenticationError('Ancien mot de passe incorrect.')
    }

    // Valider le nouveau mot de passe
    const validated = Validators.password(newPassword)
    if (confirmPassword && newPassword !== confirmPassword) {
      throw new ValidationError('Les nouveaux mots de passe ne correspondent pas.')
    }

    const hashedPassword = await bcrypt.hash(validated, 10)
    db.prepare("UPDATE users SET password = ?, updatedAt = datetime('now') WHERE id = ?")
      .run(hashedPassword, req.user.id)

    res.json({ message: 'Mot de passe changé avec succès.' })
  }
}
