const { Sequelize, DataTypes } = require('sequelize');

const DB_URL = 'postgresql://neondb_owner:npg_e4D1URqKTfbS@ep-super-star-adyat9th-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sequelize = new Sequelize(DB_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

const Literature = sequelize.define('Literature', {
  id: { type: DataTypes.UUID, primaryKey: true },
  title: DataTypes.STRING,
  bookBrain: DataTypes.JSON
}, { timestamps: false, tableName: 'Literature' });

async function run() {
  const books = await Literature.findAll({ where: { title: "Rosie and the Hidden Garden" } });
  if (books.length === 0) return console.log("Book not found");
  
  const lit = books[0];
  
  const mockBookBrain = {
    characters: [
      { name: "Rosie", importance: 5, description: "A curious young girl." },
      { name: "Grandpa", importance: 4, description: "A wise old man with a garden." }
    ],
    vocabulary: [
      { word: "curious", difficulty: 0.2, category: "vocabulary" },
      { word: "garden", difficulty: 0.1, category: "vocabulary" },
      { word: "hidden", difficulty: 0.1, category: "vocabulary" },
      { word: "mysterious", difficulty: 0.4, category: "vocabulary" }
    ],
    relationships: [],
    locations: [ { name: "The Hidden Garden" } ]
  };
  
  await lit.update({ bookBrain: mockBookBrain });
  console.log("Injected mock data successfully.");
  process.exit(0);
}

run();
