/**
 * Script d'initialisation: Crée les médecins de test
 * Usage: node init-doctors.js
 */

import 'dotenv/config'
import bcryptjs from 'bcryptjs'
import { db } from './db.js'

console.log('🔧 Initialisation des médecins...')

try {
  // Données des médecins
  const doctorsData = [
    {
      firstName: 'Nkoulou',
      lastName: 'Mbarga',
      email: 'nkoulou.mbarga@angeloclinic.com',
      phone: '+237699887766',
      password: 'password123',
      specialization: 'Médecine Générale',
      bio: 'Le Dr. Nkoulou Mbarga est un médecin généraliste expérimenté, diplômé de la Faculté de Médecine de Yaoundé. Il prend en charge les pathologies courantes et assure le suivi médical global de ses patients avec une approche humaine et rigoureuse.',
      consultationFee: 15000
    },
    {
      firstName: 'Fotso',
      lastName: 'Kamga',
      email: 'fotso.kamga@angeloclinic.com',
      phone: '+237698776655',
      password: 'password123',
      specialization: 'Cardiologie',
      bio: 'Le Dr. Fotso Kamga est cardiologue, formé en France et au Cameroun. Spécialisé dans l\'hypertension artérielle, l\'insuffisance cardiaque et les valvulopathies, il utilise les techniques les plus récentes pour le diagnostic et le traitement.',
      consultationFee: 20000
    },
    {
      firstName: 'Ngassa',
      lastName: 'Eyenga',
      email: 'ngassa.eyenga@angeloclinic.com',
      phone: '+237697665544',
      password: 'password123',
      specialization: 'Pédiatrie',
      bio: 'La Dr. Ngassa Eyenga est pédiatre, elle possède une grande expérience en soins pédiatriques et en gestion des urgences pédiatriques. Elle est connue pour son approche bienveillante avec les enfants et les parents.',
      consultationFee: 12000
    },
    {
      firstName: 'Djinné',
      lastName: 'Tchio',
      email: 'djinne.tchio@angeloclinic.com',
      phone: '+237696554433',
      password: 'password123',
      specialization: 'Gynécologie-Obstétrique',
      bio: 'La Dr. Djinné Tchio est gynécologue-obstétricienne, elle accompagne les femmes tout au long de leur vie. Spécialisée dans le suivi de grossesse, l\'accouchement et la planification familiale avec une approche humaniste.',
      consultationFee: 18000
    },
    {
      firstName: 'Mokam',
      lastName: 'Pondé',
      email: 'mokam.ponde@angeloclinic.com',
      phone: '+237695443322',
      password: 'password123',
      specialization: 'Dermatologie',
      bio: 'Le Dr. Mokam Pondé est dermatologue, expert en diagnostic et traitement des affections dermatologiques. Il possède une expérience reconnue en traitement des allergies cutanées et soins esthétiques dermatologiques.',
      consultationFee: 16000
    },
    {
      firstName: 'Essomba',
      lastName: 'Moise',
      email: 'essomba.moise@angeloclinic.com',
      phone: '+237694332211',
      password: 'password123',
      specialization: 'Ophtalmologie',
      bio: 'Le Dr. Essomba Moise est ophtalmologiste, il prend en charge tous les problèmes de vision. Formé dans les meilleures cliniques internationales, il pratique la chirurgie de la cataracte et du glaucome.',
      consultationFee: 17000
    }
  ]

  // Vérifier et créer les médecins
  for (const doctorData of doctorsData) {
    // Vérifier si l'email existe déjà
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(doctorData.email)
    
    if (existingUser) {
      console.log(`⏭️  ${doctorData.firstName} ${doctorData.lastName} existe déjà (ID: ${existingUser.id})`)
      continue
    }

    // Créer l'utilisateur avec rôle 'doctor'
    const hashedPassword = bcryptjs.hashSync(doctorData.password, 10)
    const result = db.prepare(`
      INSERT INTO users (
        firstName, lastName, email, phone, password, role, isActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'doctor', 1, datetime('now'), datetime('now'))
    `).run(
      doctorData.firstName,
      doctorData.lastName,
      doctorData.email,
      doctorData.phone,
      hashedPassword
    )

    const userId = result.lastInsertRowid

    // Créer le profil médecin
    db.prepare(`
      INSERT INTO doctors (
        userId, specialization, bio, consultationFee, isAvailable, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(
      userId,
      doctorData.specialization,
      doctorData.bio,
      doctorData.consultationFee
    )

    console.log(`✅ Créé: Dr. ${doctorData.firstName} ${doctorData.lastName}`)
    console.log(`   Email: ${doctorData.email}`)
    console.log(`   Spécialité: ${doctorData.specialization}`)
  }

  console.log('\n✨ Initialisation terminée!')
  console.log('\nMédecins créés:')
  const allDoctors = db.prepare(`
    SELECT d.id, u.firstName, u.lastName, u.email, d.specialization
    FROM doctors d
    JOIN users u ON d.userId = u.id
    ORDER BY u.firstName ASC
  `).all()

  allDoctors.forEach(doc => {
    console.log(`  [ID: ${doc.id}] Dr. ${doc.firstName} ${doc.lastName} - ${doc.specialization}`)
  })

} catch (error) {
  console.error('❌ Erreur:', error.message)
  process.exit(1)
}
