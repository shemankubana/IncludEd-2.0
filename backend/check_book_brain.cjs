const { Literature } = require('./src/models/literature');
const { sequelize } = require('./src/config/database');

async function checkBookBrain() {
  try {
    const book = await Literature.findOne({
      where: { title: 'qwerty' },
      order: [['createdAt', 'DESC']]
    });

    if (!book) {
      console.log('Book not found');
      return;
    }

    console.log('Title:', book.title);
    console.log('BookBrain Characters:', JSON.stringify(book.bookBrain?.characters, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

checkBookBrain();
