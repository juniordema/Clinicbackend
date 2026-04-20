/**
 * Routes des notifications
 */

import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { NotificationService } from '../services/notificationService.js'
import { NotFoundError } from '../utils/errors.js'
import { AuditService } from '../services/auditService.js'

const router = express.Router()

// Toutes les routes de notifications requirent l'authentification
router.use(authMiddleware)

/**
 * GET /api/notifications/unread-count
 * Compte les notifications non lues
 */
router.get('/unread-count', asyncHandler((req, res) => {
  const count = NotificationService.getUnreadCount(req.user.id)
  res.json({ unreadCount: count })
}))

/**
 * GET /api/notifications
 * Récupère les notifications de l'utilisateur
 */
router.get('/', asyncHandler((req, res) => {
  const { limit = 20, unreadOnly = false } = req.query
  const notifications = NotificationService.getNotifications(req.user.id, parseInt(limit), unreadOnly === 'true')
  res.json(notifications)
}))

/**
 * PATCH /api/notifications/read-all
 * Marque toutes les notifications comme lues
 */
router.patch('/read-all', asyncHandler((req, res) => {
  NotificationService.markAllAsRead(req.user.id)
  res.json({ message: 'Toutes les notifications sont marquées comme lues.' })
}))

/**
 * PATCH /api/notifications/:id/read
 * Marque une notification comme lue
 */
router.patch('/:id/read', asyncHandler((req, res) => {
  if (!NotificationService.getByIdForUser(req.params.id, req.user.id)) {
    AuditService.log(req.user.id, 'notification_access_denied', 'notification', Number(req.params.id), {
      route: 'PATCH /api/notifications/:id/read'
    })
    throw new NotFoundError('Notification non trouvée.')
  }
  NotificationService.markAsRead(req.params.id)
  res.json({ message: 'Notification marquée comme lue.' })
}))

/**
 * DELETE /api/notifications/:id
 * Supprime une notification
 */
router.delete('/:id', asyncHandler((req, res) => {
  if (!NotificationService.getByIdForUser(req.params.id, req.user.id)) {
    AuditService.log(req.user.id, 'notification_access_denied', 'notification', Number(req.params.id), {
      route: 'DELETE /api/notifications/:id'
    })
    throw new NotFoundError('Notification non trouvée.')
  }
  NotificationService.deleteNotification(req.params.id)
  res.json({ message: 'Notification supprimée.' })
}))

export default router
