import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthContext from './context/AuthContext';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Diary from './pages/Diary';
import AuthScreen from './components/AuthScreen';
import Navbar from './components/Navbar';
import { Loader } from 'lucide-react';

function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {user ? (
        <>
          <Navbar />
          <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Library />} />
              <Route path="/diary" element={<Diary />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </>
      ) : (
        <Routes>
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="*" element={<Navigate to="/auth" />} />
        </Routes>
      )}
    </div>
  );
}

export default App;

