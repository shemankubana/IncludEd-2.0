import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { db, type Literature } from '../db/db';

const StudentDashboard: React.FC = () => {
  const [books, setBooks] = useState<Literature[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load offline books from IndexedDB
    const loadBooks = async () => {
      const allBooks = await db.literature.toArray();
      setBooks(allBooks);
    };
    loadBooks();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-600">My Library</h1>
      
      {books.length === 0 ? (
        <div className="text-center p-10 bg-blue-50 rounded-xl">
          <p className="text-xl text-gray-700">You don't have any books downloaded yet!</p>
          <p className="text-gray-500 mt-2">Connect to the internet to sync your assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {books.map((book) => (
            <div 
              key={book.id} 
              onClick={() => navigate(`/student/read/${book.id}`)}
              className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl cursor-pointer transition-shadow border-l-8 border-yellow-400"
            >
              <h2 className="text-2xl font-bold mb-2 flex items-center">
                <BookOpen className="mr-3 text-blue-500" /> {book.title}
              </h2>
              <p className="text-gray-600 text-lg">By {book.author}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;