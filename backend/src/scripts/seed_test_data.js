import admin, { auth } from '../config/firebase-admin.js';
import { User } from '../models/User.js';
import { School } from '../models/School.js';
import { StudentStats } from '../models/StudentStats.js';
import { sequelize } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const testUsers = [
    {
        email: 'admin@kps.rw',
        password: 'password123',
        firstName: 'System',
        lastName: 'Admin',
        role: 'admin',
        status: 'active'
    },
    {
        email: 'teacher@kps.rw',
        password: 'password123',
        firstName: 'John',
        lastName: 'Mugisha',
        role: 'teacher',
        status: 'active'
    },
    {
        email: 'student1@kps.rw',
        password: 'password123',
        firstName: 'Aline',
        lastName: 'Uwase',
        role: 'student',
        status: 'active'
    },
    {
        email: 'student2@kps.rw',
        password: 'password123',
        firstName: 'Peter',
        lastName: 'Karekezi',
        role: 'student',
        status: 'active'
    },
    {
        email: 'student3@kps.rw',
        password: 'password123',
        firstName: 'Grace',
        lastName: 'Inshuti',
        role: 'student',
        status: 'active'
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

            // 3. Init student stats
            if (userData.role === 'student') {
                const [stats] = await StudentStats.findOrCreate({
                    where: { userId: user.id },
                    defaults: {
                        schoolId: school.id,
                        xp: 0,
                        level: 1,
                        streak: 0
                    }
                });
                console.log(`   - Student stats initialized.`);
            }
        }

        console.log('\n✨ Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    }
}

seed();
