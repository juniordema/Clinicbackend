import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'angelo-clinic.db')

let sqlite
try {
  const mod = await import('node:sqlite')
  sqlite = mod
} catch {
  console.error('❌  Lance avec : node --experimental-sqlite server.js')
  process.exit(1)
}

const { DatabaseSync } = sqlite
export const db = new DatabaseSync(DB_PATH)

db.exec(`PRAGMA journal_mode = WAL;`)
db.exec(`PRAGMA foreign_keys = ON;`)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName   TEXT    NOT NULL,
    lastName    TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    phone       TEXT    DEFAULT '',
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'patient' CHECK(role IN ('patient','doctor','admin')),
    isActive    BOOLEAN DEFAULT 1,
    createdAt   TEXT    DEFAULT (datetime('now')),
    updatedAt   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    userId          INTEGER NOT NULL UNIQUE,
    specialization  TEXT    NOT NULL,
    bio             TEXT    DEFAULT '',
    profileImage    TEXT    DEFAULT NULL,
    consultationFee REAL    DEFAULT 0,
    isAvailable     BOOLEAN DEFAULT 1,
    createdAt       TEXT    DEFAULT (datetime('now')),
    updatedAt       TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    userId          INTEGER DEFAULT NULL,
    guestName       TEXT    DEFAULT NULL,
    guestPhone      TEXT    DEFAULT NULL,
    guestEmail      TEXT    DEFAULT NULL,
    doctorId        INTEGER NOT NULL,
    serviceName     TEXT    NOT NULL,
    date            TEXT    NOT NULL,
    time            TEXT    NOT NULL,
    notes           TEXT    DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
    doctorNotes     TEXT    DEFAULT '',
    createdAt       TEXT    DEFAULT (datetime('now')),
    updatedAt       TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (userId)   REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (doctorId) REFERENCES doctors(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_slot 
    ON appointments(doctorId, date, time) 
    WHERE status != 'cancelled';

  CREATE TABLE IF NOT EXISTS reminders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    appointmentId INTEGER NOT NULL,
    type          TEXT    NOT NULL CHECK(type IN ('24h','1h')),
    status        TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
    sentAt        TEXT    DEFAULT NULL,
    failureReason TEXT    DEFAULT NULL,
    createdAt     TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (appointmentId) REFERENCES appointments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    INTEGER NOT NULL,
    type      TEXT    NOT NULL, -- 'appointment_created', 'appointment_confirmed', 'appointment_cancelled', etc.
    title     TEXT    NOT NULL,
    message   TEXT    NOT NULL,
    isRead    BOOLEAN DEFAULT 0,
    data      TEXT    DEFAULT NULL, -- JSON avec détails (appointmentId, etc.)
    createdAt TEXT    DEFAULT (datetime('now')),
    readAt    TEXT    DEFAULT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT    DEFAULT '',
    duration    INTEGER DEFAULT 30, -- en minutes
    isActive    BOOLEAN DEFAULT 1,
    createdAt   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    INTEGER,
    action    TEXT    NOT NULL,
    entityType TEXT,
    entityId  INTEGER,
    details   TEXT,
    timestamp TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
  );
`)

console.log(`✅  SQLite connecté → ${DB_PATH}`)
