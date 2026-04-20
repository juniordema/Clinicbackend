/**
 * Middleware de gestion des erreurs
 */

import { AppError, errorResponse } from '../utils/errors.js'

export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err)

  if (err instanceof AppError) {
    const { statusCode, error } = errorResponse(err)
    return res.status(statusCode).json(error)
  }

  // Erreur non gérée
  const { statusCode, error } = errorResponse(
    new Error(err.message || 'Erreur interne du serveur')
  )
  res.status(statusCode).json(error)
}

/**
 * Wrapper pour les routes async pour capturer les erreurs
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
