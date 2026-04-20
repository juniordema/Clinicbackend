/**
 * Classes d'erreur personnalisées pour une meilleure gestion
 */

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
    this.timestamp = new Date().toISOString()
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentification requise.') {
    super(message, 401)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Vous n\'avez pas les permissions requises.') {
    super(message, 403)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource non trouvée.') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}

export class InternalError extends AppError {
  constructor(message = 'Erreur serveur interne.') {
    super(message, 500)
    this.name = 'InternalError'
  }
}

export function errorResponse(err) {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Erreur interne du serveur'
  return {
    statusCode,
    error: {
      name: err.name || 'Error',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  }
}
