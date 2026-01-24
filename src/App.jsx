import React, { useState, useEffect, useRef } from 'react';
import { getCurrentUser, isAuthenticated } from './utils/auth';
import { initializeStorage } from './utils/storage';
import Login from './pages/Login';
import LoadingPage from './pages/LoadingPage';
import MainLayout from './pages/MainLayout';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoadingPage, setShowLoadingPage] = useState(false);
  const pendingUserRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      // Initialize storage with default data
      await initializeStorage();

      // Check if user is already logged in (and not expired)
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      setLoading(false);
    };

    init();

    // Check session expiration every minute
    const sessionCheckInterval = setInterval(() => {
      if (user) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          // Session expired
          setUser(null);
        }
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(sessionCheckInterval);
  }, [user]);

  const handleLogin = (userData) => {
    // Store user data in ref
    pendingUserRef.current = userData;
    // Show loading page
    setShowLoadingPage(true);
  };

  const handleLoadingComplete = () => {
    // Set user after loading animation completes
    setUser(pendingUserRef.current);
    setShowLoadingPage(false);
    pendingUserRef.current = null;
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

  // Show loading page during transition
  if (showLoadingPage) {
    return <LoadingPage onComplete={handleLoadingComplete} />;
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
