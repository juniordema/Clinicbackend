/**
 * Middlewares d'authentification et d'autorisation
 */

import jwt from 'jsonwebtoken'
import { AuthenticationError, AuthorizationError } from '../utils/errors.js'
import { db } from '../db.js'

export const JWT_SECRET = process.env.JWT_SECRET || 'angelo_clinic_secret_change_me_in_production'

/**
 * Middleware : vérifie que l'utilisateur est authentifié
 */
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token manquant ou invalide.')
    }
    
    const token = authHeader.split(' ')[1]
    req.user = jwt.verify(token, JWT_SECRET)
    
    // Vérifier que l'utilisateur existe toujours
    const user = db.prepare('SELECT id, role, isActive FROM users WHERE id = ?').get(req.user.id)
    if (!user) {
      throw new AuthenticationError('Utilisateur non trouvé.')
    }
    if (!user.isActive) {
      throw new AuthenticationError('Compte désactivé.')
    }
    
    req.user.role = user.role
    next()
  } catch (err) {
    res.status(401).json({ error: err.message || 'Authentification requise.' })
  }
}

/**
 * Middleware : vérifie les permissions par rôle
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé. Rôle insuffisant.' })
    }
    next()
  }
}

/**
 * Middleware : optionnel - charge les données utilisateur si connecté
 */
export function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      req.user = jwt.verify(token, JWT_SECRET)
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.user.id)
      if (user) {
        req.user.role = user.role
      }
    }
  } catch (err) {
    // Silently ignore invalid token
  }
  next()
}

/**
 * Crée un token JWT pour un utilisateur
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}
