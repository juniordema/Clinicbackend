import { db } from '../db.js'

export class AuditService {
  static log(userId, action, entityType = null, entityId = null, details = null) {
    const serializedDetails = details ? JSON.stringify(details) : null
    db.prepare(
      `INSERT INTO audit_logs (userId, action, entityType, entityId, details)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId || null, action, entityType, entityId, serializedDetails)
  }
}

export default AuditService
