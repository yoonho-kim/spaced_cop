import React, { useState, useEffect } from 'react';
import { getCurrentUser, isAuthenticated } from './utils/auth';
import { initializeStorage } from './utils/storage';
import Login from './pages/Login';
import MainLayout from './pages/MainLayout';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize storage with default data
    initializeStorage();

    // Check if user is already logged in
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#000'
      }}>
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <MainLayout user={user} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
