const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

const Literature = sequelize.define('Literature', {
  id: { type: DataTypes.UUID, primaryKey: true },
  title: DataTypes.STRING,
  sections: DataTypes.JSON,
  bookBrain: DataTypes.JSON,
  status: DataTypes.STRING,
  questionsGenerated: DataTypes.INTEGER
}, { tableName: 'Literature' });

async function reanalyze() {
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8082';
  
  try {
    const literature = await Literature.findOne({
      where: { status: 'processing' },
      order: [['createdAt', 'DESC']]
    });

    if (!literature) {
      console.log('No books in processing status found.');
      return;
    }

    console.log(`🧠 Re-analyzing: ${literature.title} (${literature.id})`);
    
    const sections = literature.sections.map(s => s.content);
    const titles = literature.sections.map(s => s.title);

    console.log(`   - 1/2: Extracting Characters (NER)...`);
    const nerResp = await axios.post(`${AI_SERVICE_URL}/ner/extract`, {
      sections,
      title: literature.title
    }, { timeout: 180000 });

    console.log(`   - 2/2: Mapping Vocabulary...`);
    const vocabResp = await axios.post(`${AI_SERVICE_URL}/vocab/batch-analyze`, {
      sections,
      section_titles: titles
    }, { timeout: 180000 });

    const bookBrain = {
      ...(literature.bookBrain || {}),
      characters: nerResp.data.characters || [],
      relationships: nerResp.data.relationships || [],
      locations: nerResp.data.locations || [],
      vocabulary: vocabResp.data.vocabulary || []
    };

    await literature.update({ 
      bookBrain,
      status: 'draft' 
    });

    console.log(`✅ Success! ${literature.title} is now in DRAFT status.`);
    console.log(`   - Found ${bookBrain.characters.length} characters`);
    console.log(`   - Found ${bookBrain.vocabulary.length} vocab words`);

  } catch (err) {
    console.error(`❌ Re-analysis failed: ${err.message}`);
    if (err.response) {
      console.error(`   - AI Service error: ${JSON.stringify(err.response.data)}`);
    }
  } finally {
    await sequelize.close();
  }
}

reanalyze();
