import admin, { auth } from '../config/firebase-admin.js';
import { User } from '../models/User.js';
import { School } from '../models/School.js';
import { StudentStats } from '../models/StudentStats.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { sequelize } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const testUsers = [
    {
        email: 'admin@kps.rw',
        password: 'Password123!',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        status: 'active'
    },
    {
        email: 'teacher@kps.rw',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Mugisha',
        role: 'teacher',
        status: 'active'
    },
    {
        email: 'student1@kps.rw',
        password: 'Password123!',
        firstName: 'Aline',
        lastName: 'Uwase',
        role: 'student',
        status: 'active',
        // Dyslexia profile — exercises syllable break + TTS actions
        profile: {
            gradeLevel: 'P4',
            disabilityType: 'dyslexia',
            disabilityTypeEncoded: 0.5,
            dyslexiaScore: 72.0,
            fontPreference: 'opendyslexic',
            ttsEnabled: true,
            lineSpacing: 2.0,
            preferredLanguage: 'english'
        }
    },
    {
        email: 'student2@kps.rw',
        password: 'Password123!',
        firstName: 'Peter',
        lastName: 'Karekezi',
        role: 'student',
        status: 'active',
        // ADHD profile — exercises attention break + heavy simplify actions
        profile: {
            gradeLevel: 'P5',
            disabilityType: 'adhd',
            disabilityTypeEncoded: 1.0,
            adhdScore: 68.0,
            fontPreference: 'arial',
            ttsEnabled: false,
            lineSpacing: 1.8,
            preferredLanguage: 'english'
        }
    },
    {
        email: 'student3@kps.rw',
        password: 'Password123!',
        firstName: 'Grace',
        lastName: 'Inshuti',
        role: 'student',
        status: 'active',
        // No disability — baseline/control group for thesis Cohen's d
        profile: {
            gradeLevel: 'P4',
            disabilityType: 'none',
            disabilityTypeEncoded: 0.0,
            fontPreference: 'default',
            ttsEnabled: false,
            lineSpacing: 1.5,
            preferredLanguage: 'french'
        }
    }
];

async function seed() {
    try {
        console.log('🚀 Starting test data seeding...');

        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Ensure tables exist
        await sequelize.sync({ alter: true });
        console.log('✅ Database schema synced');

        // 1. Create School
        const [school] = await School.findOrCreate({
            where: { code: 'KPS2024' },
            defaults: {
                name: 'Kigali Parents School',
                city: 'Kigali',
                country: 'Rwanda',
                emailDomain: 'kps.rw',
                isActive: true
            }
        });
        console.log(`🏫 School: ${school.name} (${school.code})`);

        for (const userData of testUsers) {
            console.log(`👤 Processing ${userData.email}...`);

            let firebaseUser;
            try {
                firebaseUser = await auth.getUserByEmail(userData.email);
                console.log(`   - Firebase user already exists: ${firebaseUser.uid}`);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    firebaseUser = await auth.createUser({
                        email: userData.email,
                        password: userData.password,
                        displayName: `${userData.firstName} ${userData.lastName}`,
                    });
                    console.log(`   - Created Firebase user: ${firebaseUser.uid}`);
                } else {
                    throw error;
                }
            }

            // 2. Create/Update local user
            // We use upsert or findOne+update to ensure synchronization
            let user = await User.findByPk(firebaseUser.uid);

            const userPayload = {
                id: firebaseUser.uid,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role,
                schoolId: school.id,
                status: userData.status,
                yearEnrolled: new Date().getFullYear()
            };

            if (user) {
                await user.update(userPayload);
                console.log(`   - Local user record updated.`);
            } else {
                user = await User.create(userPayload);
                console.log(`   - Local user record created.`);
            }

            // 3. Init student stats + profile
            if (userData.role === 'student') {
                await StudentStats.findOrCreate({
                    where: { userId: user.id },
                    defaults: {
                        schoolId: school.id,
                        xp: 0,
                        level: 1,
                        streak: 0
                    }
                });
                console.log(`   - Student stats initialized.`);

                await StudentProfile.findOrCreate({
                    where: { userId: user.id },
                    defaults: { userId: user.id, ...userData.profile }
                });
                console.log(`   - Student profile initialized (disability: ${userData.profile.disabilityType}).`);
            }
        }

        console.log('\n✨ Seeding completed successfully!');
        console.log('\n📋 Test Accounts:');
        console.log('   admin@kps.rw       / Password123!  (admin)');
        console.log('   teacher@kps.rw     / Password123!  (teacher)');
        console.log('   student1@kps.rw    / Password123!  (dyslexia — Aline)');
        console.log('   student2@kps.rw    / Password123!  (adhd — Peter)');
        console.log('   student3@kps.rw    / Password123!  (none — Grace, control group)');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    }
}

seed();
