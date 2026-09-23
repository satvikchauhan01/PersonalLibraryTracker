import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthContext from './context/AuthContext';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Diary from './pages/Diary';
import Shelves from './pages/Shelves';
import Dashboard from './pages/Dashboard';
import Friends from './pages/Friends';
import Messages from './pages/Messages';
import Billing from './pages/Billing';
import Admin from './pages/Admin';
import ResetPassword from './pages/ResetPassword'; // Phase 12
import AuthScreen from './components/AuthScreen';
import Navbar from './components/Navbar';
import { Loader } from 'lucide-react';

function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neu-background">
        <Loader size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neu-background font-sans transition-colors">
      {user ? (
        <>
          <Navbar />
          <main className="max-w-7xl mx-auto pt-28 pb-12 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Library />} />
              <Route path="/shelves" element={<Shelves />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/diary" element={<Diary />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/admin"
                element={user.role === 'admin' ? <Admin /> : <Navigate to="/" />}
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </>
      ) : (
        <Routes>
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/auth" />} />
        </Routes>
      )}
    </div>
  );
}

export default App;
