/**
 * Routes d'authentification
 */

import express from 'express'
import { AuthController } from '../controllers/authController.js'
import { authMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = express.Router()

// Routes publiques
router.post('/register', asyncHandler(AuthController.register))
router.post('/login', asyncHandler(AuthController.login))

// Routes protégées
router.get('/me', authMiddleware, asyncHandler(AuthController.getProfile))
router.patch('/me', authMiddleware, asyncHandler(AuthController.updateProfile))
router.post('/change-password', authMiddleware, asyncHandler(AuthController.changePassword))

export default router
