export const STORAGE_KEYS = {
  USER: 'spaced_user',
  LUNCH_PICK_RESULTS: 'spaced_lunch_pick_results',
  VOLUNTEER_RESULT_SCRATCHES: 'spaced_volunteer_result_scratches',
};

export const getItem = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return null;
  }
};

export const setItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
    return false;
  }
};

export const removeItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing item ${key}:`, error);
    return false;
  }
};
