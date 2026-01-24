import { STORAGE_KEYS, getItem, setItem, removeItem } from './storage';

// Session expires after 10 hours (in milliseconds)
const SESSION_DURATION = 10 * 60 * 60 * 1000;

export const login = (nickname, password = null) => {
    const user = {
        nickname,
        isAdmin: false,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    };

    // Check if admin login
    if (nickname === 'admin') {
        const adminPassword = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
        if (password === adminPassword) {
            user.isAdmin = true;
        } else {
            return { success: false, error: 'Invalid admin password' };
        }
    }

    setItem(STORAGE_KEYS.USER, user);
    return { success: true, user };
};

export const logout = () => {
    removeItem(STORAGE_KEYS.USER);
};

export const getCurrentUser = () => {
    const user = getItem(STORAGE_KEYS.USER);

    if (!user) return null;

    // Check if session has expired
    if (user.expiresAt) {
        const expiresAt = new Date(user.expiresAt);
        if (new Date() > expiresAt) {
            // Session expired, clear user data
            logout();
            return null;
        }
    }

    return user;
};

export const isAuthenticated = () => {
    return getCurrentUser() !== null;
};

export const isAdmin = () => {
    const user = getCurrentUser();
    return user && user.isAdmin === true;
};

export const updateAdminPassword = (newPassword) => {
    if (!isAdmin()) {
        return { success: false, error: 'Unauthorized' };
    }
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, newPassword);
    return { success: true };
};

export const getAdminPassword = () => {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
};

// Get remaining session time in minutes
export const getSessionRemainingTime = () => {
    const user = getItem(STORAGE_KEYS.USER);
    if (!user || !user.expiresAt) return 0;

    const remaining = new Date(user.expiresAt) - new Date();
    return Math.max(0, Math.floor(remaining / 60000)); // Return minutes
};

// Extend session (refresh expiration time)
export const extendSession = () => {
    const user = getItem(STORAGE_KEYS.USER);
    if (user) {
        user.expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
        setItem(STORAGE_KEYS.USER, user);
    }
};
