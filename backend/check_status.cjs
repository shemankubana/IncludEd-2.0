const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://ivan:password@localhost:5432/included_db', {
  logging: false
});

const Literature = sequelize.define('Literature', {
  id: { type: DataTypes.UUID, primaryKey: true },
  title: DataTypes.STRING,
  bookBrain: DataTypes.JSON,
  status: DataTypes.STRING,
  createdAt: DataTypes.DATE
});

async function check() {
  try {
    const latest = await Literature.findOne({
      order: [['createdAt', 'DESC']]
    });
    if (!latest) {
      console.log('No literature found');
    } else {
      console.log(JSON.stringify({
        title: latest.title,
        status: latest.status,
        hasBrain: !!latest.bookBrain,
        brainLength: latest.bookBrain ? JSON.stringify(latest.bookBrain).length : 0
      }, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

check();
