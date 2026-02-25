import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { getCurrentUser } from './utils/auth';
import { initializeStorage } from './utils/storage';
import './index.css';

const Login = React.lazy(() => import('./pages/Login'));
const LoadingPage = React.lazy(() => import('./pages/LoadingPage'));
const MainLayout = React.lazy(() => import('./pages/MainLayout'));

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
    try {
      sessionStorage.setItem('spaced_show_event_popup', '1');
    } catch (error) {
      // ignore sessionStorage errors
    }
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
    return (
      <Suspense fallback={null}>
        <LoadingPage onComplete={handleLoadingComplete} />
      </Suspense>
    );
  }

  return (
    <>
      <Suspense
        fallback={(
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: '#000'
          }}>
            <div className="loading"></div>
          </div>
        )}
      >
        {!user ? (
          <Login onLogin={handleLogin} />
        ) : (
          <MainLayout user={user} onLogout={handleLogout} />
        )}
      </Suspense>
      <Analytics />
    </>
  );
}

export default App;
