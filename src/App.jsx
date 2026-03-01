import React, { Suspense, useState, useEffect, useRef } from 'react';
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
  // 세션 만료 체크 interval이 최신 user 값을 참조하도록 ref 사용
  // (useEffect 의존성에 user를 넣지 않아도 항상 최신 상태 접근 가능)
  const userRef = useRef(null);

  // userRef를 user state와 동기화
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const init = async () => {
      // Initialize storage with default data
      await initializeStorage();

      // 앱 최초 마운트 시 저장된 세션이 있으면 복원
      // (이미 로그인된 상태라면 handleLogin/handleLoadingComplete에서 setUser가 호출됨)
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
      setLoading(false);
    };

    init();

    // Check session expiration every minute
    // userRef를 통해 최신 user 참조 → useEffect 재실행(무한 루프) 없이 동작
    const sessionCheckInterval = setInterval(() => {
      if (userRef.current) {
        const currentUser = getCurrentUser();
        if (!currentUser) {
          // Session expired
          setUser(null);
        }
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(sessionCheckInterval);
  }, []); // 마운트 1회만 실행 — user 변경 시 재실행하지 않음

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
  );
}

export default App;
