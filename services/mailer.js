/**
 * Service Email - Gère tous les emails de l'application
 */

import nodemailer from 'nodemailer'

let transporter = null

function initTransporter() {
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  })

  return transporter
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export class MailerService {
  /**
   * Envoie un email de confirmation de rendez-vous
   */
  static async sendAppointmentConfirmation({ to, name, doctorName, serviceName, date, time, appointmentId }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.log('📧 [DEV] Email de confirmation simulé pour', to)
      return
    }

    const transporter = initTransporter()
    
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Angelo Clinic <noreply@angelo-clinic.cm>',
        to,
        subject: `✅ Confirmation de votre rendez-vous — Angelo Clinic`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
            <div style="background:#0A6B5C;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:22px;">🏥 Centre Médical Angelo</h1>
            </div>
            <div style="background:#f9fafb;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
              <p style="font-size:16px;color:#1f2937;">Bonjour <strong>${name}</strong>,</p>
              <p style="color:#4b5563;">Votre rendez-vous a bien été enregistré :</p>
              <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #0A6B5C;">
                <p style="margin:6px 0;color:#374151;">📋 <strong>Service :</strong> ${serviceName}</p>
                <p style="margin:6px 0;color:#374151;">👨‍⚕️ <strong>Médecin :</strong> ${doctorName}</p>
                <p style="margin:6px 0;color:#374151;">📅 <strong>Date :</strong> ${formatDate(date)}</p>
                <p style="margin:6px 0;color:#374151;">⏰ <strong>Heure :</strong> ${time}</p>
                <p style="margin:6px 0;color:#374151;">🔖 <strong>Réf. :</strong> #${appointmentId}</p>
              </div>
              <p style="color:#6b7280;font-size:14px;">Présentez-vous 10 minutes avant votre rendez-vous.</p>
              <p style="color:#6b7280;font-size:13px;">📍 Quartier Logpom, Douala · 📞 +237 6 99 88 77 66</p>
            </div>
          </div>
        `
      })
      console.log(`📧 Email de confirmation envoyé à ${to}`)
    } catch (err) {
      console.error('❌ Erreur email:', err.message)
      throw err
    }
  }

  /**
   * Envoie un email de rappel (24h ou 1h avant)
   */
  static async sendReminderEmail({ to, name, doctorName, date, time, type = '24h' }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.log(`📧 [DEV] Email rappel ${type} simulé pour ${to}`)
      return
    }

    const transporter = initTransporter()
    const timeLabel = type === '24h' ? 'demain' : 'dans 1 heure'

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Angelo Clinic <noreply@angelo-clinic.cm>',
        to,
        subject: `🔔 Rappel : votre rendez-vous ${timeLabel} — Angelo Clinic`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
            <div style="background:#0A6B5C;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:22px;">🏥 Centre Médical Angelo</h1>
            </div>
            <div style="background:#f9fafb;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
              <p style="font-size:16px;color:#1f2937;">Bonjour <strong>${name}</strong>,</p>
              <p style="color:#4b5563;">Ceci est un rappel de votre rendez-vous :</p>
              <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #F59E0B;">
                <p style="margin:6px 0;color:#374151;">👨‍⚕️ <strong>Médecin :</strong> ${doctorName}</p>
                <p style="margin:6px 0;color:#374151;">📅 <strong>Date :</strong> ${formatDate(date)}</p>
                <p style="margin:6px 0;color:#374151;">⏰ <strong>Heure :</strong> ${time}</p>
              </div>
              <p style="color:#6b7280;font-size:14px;">À bientôt !</p>
            </div>
          </div>
        `
      })
      console.log(`📧 Rappel ${type} envoyé à ${to}`)
    } catch (err) {
      console.error('❌ Erreur rappel email:', err.message)
      throw err
    }
  }

  /**
   * Envoie un email de notification de nouveau rendez-vous au médecin
   */
  static async sendDoctorNotification({ to, doctorName, patientName, serviceName, date, time, appointmentId }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.log(`📧 [DEV] Email notification médecin simulé pour ${to}`)
      return
    }

    const transporter = initTransporter()

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Angelo Clinic <noreply@angelo-clinic.cm>',
        to,
        subject: `📅 Nouveau rendez-vous — Angelo Clinic`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
            <div style="background:#0A6B5C;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:22px;">🏥 Centre Médical Angelo</h1>
            </div>
            <div style="background:#f9fafb;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
              <p style="font-size:16px;color:#1f2937;">Bonjour Dr. <strong>${doctorName}</strong>,</p>
              <p style="color:#4b5563;">Un nouveau rendez-vous a été créé :</p>
              <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #10B981;">
                <p style="margin:6px 0;color:#374151;">👤 <strong>Patient :</strong> ${patientName}</p>
                <p style="margin:6px 0;color:#374151;">📋 <strong>Service :</strong> ${serviceName}</p>
                <p style="margin:6px 0;color:#374151;">📅 <strong>Date :</strong> ${formatDate(date)}</p>
                <p style="margin:6px 0;color:#374151;">⏰ <strong>Heure :</strong> ${time}</p>
                <p style="margin:6px 0;color:#374151;">🔖 <strong>ID :</strong> #${appointmentId}</p>
              </div>
              <p style="color:#6b7280;font-size:14px;">Connectez-vous pour gérer ce rendez-vous.</p>
            </div>
          </div>
        `
      })
      console.log(`📧 Notification médecin envoyée à ${to}`)
    } catch (err) {
      console.error('❌ Erreur notification médecin:', err.message)
      throw err
    }
  }

  /**
   * Envoie un email de décision du médecin au patient
   */
  static async sendAppointmentDecision({ to, name, doctorName, date, time, status }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.log(`📧 [DEV] Email décision ${status} simulé pour ${to}`)
      return
    }

    const transporter = initTransporter()
    const isConfirmed = status === 'confirmed'
    const subject = isConfirmed
      ? '✅ Votre rendez-vous a été accepté — Angelo Clinic'
      : '❌ Votre rendez-vous a été refusé — Angelo Clinic'
    const title = isConfirmed ? 'Rendez-vous accepté' : 'Rendez-vous refusé'
    const body = isConfirmed
      ? `Dr. ${doctorName} a accepté votre rendez-vous.`
      : `Dr. ${doctorName} a refusé votre rendez-vous. Veuillez choisir un autre créneau.`

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || 'Angelo Clinic <noreply@angelo-clinic.cm>',
        to,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
            <div style="background:#0A6B5C;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:22px;">🏥 Centre Médical Angelo</h1>
            </div>
            <div style="background:#f9fafb;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;">
              <p style="font-size:16px;color:#1f2937;">Bonjour <strong>${name}</strong>,</p>
              <p style="color:#4b5563;"><strong>${title}</strong></p>
              <p style="color:#4b5563;">${body}</p>
              <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid ${isConfirmed ? '#10B981' : '#EF4444'};">
                <p style="margin:6px 0;color:#374151;">👨‍⚕️ <strong>Médecin :</strong> Dr. ${doctorName}</p>
                <p style="margin:6px 0;color:#374151;">📅 <strong>Date :</strong> ${formatDate(date)}</p>
                <p style="margin:6px 0;color:#374151;">⏰ <strong>Heure :</strong> ${time}</p>
              </div>
              <p style="color:#6b7280;font-size:14px;">Consultez votre espace patient pour suivre l'état de votre rendez-vous.</p>
            </div>
          </div>
        `
      })
      console.log(`📧 Email décision ${status} envoyé à ${to}`)
    } catch (err) {
      console.error('❌ Erreur email décision:', err.message)
      throw err
    }
  }
}

// Export pour la compatibilité
export default MailerService
