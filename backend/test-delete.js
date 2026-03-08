import { sequelize } from './src/config/database.js';
import './src/server.js';
import { Literature } from './src/models/Literature.js';
import { Quiz } from './src/models/Quiz.js';
import { LessonProgress } from './src/models/LessonProgress.js';
import { Session } from './src/models/Session.js';
import { RLTrainingData } from './src/models/RLTrainingData.js';

async function testDelete() {
    await sequelize.sync();
    const lits = await Literature.findAll({ limit: 1 });
    if (lits.length === 0) {
        console.log("No literature found");
        process.exit(0);
    }
    const lit = lits[0];
    console.log("Found lit:", lit.id);
    const transaction = await sequelize.transaction();
    try {
        const sessionIds = (await Session.findAll({ where: { literatureId: lit.id }, attributes: ['id'] })).map(s => s.id);
        if (sessionIds.length > 0) {
            await RLTrainingData.destroy({ where: { sessionId: sessionIds }, transaction });
            await Session.destroy({ where: { id: sessionIds }, transaction });
        }
        await Quiz.destroy({ where: { literatureId: lit.id }, transaction });
        await LessonProgress.destroy({ where: { literatureId: lit.id }, transaction });

        console.log("Calling lit.destroy()...");
        await lit.destroy({ transaction });
        await transaction.commit();
        console.log("Success! No FK errors.");
    } catch (e) {
        if (transaction) await transaction.rollback();
        console.error("Crash!", e);
    }
    process.exit(0);
}

testDelete();
