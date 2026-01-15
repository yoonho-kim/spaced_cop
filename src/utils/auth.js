import { STORAGE_KEYS, getItem, setItem, removeItem } from './storage';

export const login = (nickname, password = null) => {
    const user = {
        nickname,
        isAdmin: false,
        loginTime: new Date().toISOString(),
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
    return getItem(STORAGE_KEYS.USER);
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
