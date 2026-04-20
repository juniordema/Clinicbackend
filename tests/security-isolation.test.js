import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const dbPath = path.join('/tmp', `angelo-clinic-security-${Date.now()}.db`)
process.env.DB_PATH = dbPath

const { db } = await import('../db.js')
const { AppointmentController } = await import('../controllers/appointmentController.js')
const { NotificationService } = await import('../services/notificationService.js')

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    }
  }
}

try {
  const patient1 = db.prepare(
    `INSERT INTO users (firstName, lastName, email, phone, password, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('Alice', 'One', 'alice@example.com', '+237690000001', 'hashed', 'patient').lastInsertRowid

  const patient2 = db.prepare(
    `INSERT INTO users (firstName, lastName, email, phone, password, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('Bob', 'Two', 'bob@example.com', '+237690000002', 'hashed', 'patient').lastInsertRowid

  const doctorUser = db.prepare(
    `INSERT INTO users (firstName, lastName, email, phone, password, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('Doc', 'Three', 'doctor@example.com', '+237690000003', 'hashed', 'doctor').lastInsertRowid

  const doctorId = db.prepare(
    `INSERT INTO doctors (userId, specialization, bio, consultationFee)
     VALUES (?, ?, ?, ?)`
  ).run(doctorUser, 'Cardiologie', '', 10000).lastInsertRowid

  const appointmentId = db.prepare(
    `INSERT INTO appointments (userId, doctorId, serviceName, date, time, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(patient1, doctorId, 'Cardiologie', '2026-05-01', '10:00', 'pending').lastInsertRowid

  const notificationId = NotificationService.createNotification(
    patient1,
    'appointment_confirmed',
    'Test',
    'Notification test',
    { appointmentId }
  )

  assert.equal(NotificationService.belongsToUser(notificationId, patient1), true)
  assert.equal(NotificationService.belongsToUser(notificationId, patient2), false)

  const res = makeRes()
  let caughtError = null
  try {
    AppointmentController.getById({ params: { id: String(appointmentId) }, user: { id: patient2 } }, res)
  } catch (error) {
    caughtError = error
  }

  assert.ok(caughtError, 'Expected access to another patient appointment to fail')
  assert.equal(caughtError.name, 'NotFoundError')

  console.log('security isolation tests: ok')
} finally {
  db.close()
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }
}
