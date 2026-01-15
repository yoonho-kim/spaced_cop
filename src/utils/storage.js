// Storage keys
export const STORAGE_KEYS = {
  USER: 'spaced_user',
  ADMIN_PASSWORD: 'spaced_admin_password',
  POSTS: 'spaced_posts',
  MEETING_ROOMS: 'spaced_meeting_rooms',
  RESERVATIONS: 'spaced_reservations',
  VOLUNTEER_ACTIVITIES: 'spaced_volunteer_activities',
  VOLUNTEER_REGISTRATIONS: 'spaced_volunteer_registrations',
  SUPPLY_REQUESTS: 'spaced_supply_requests',
};

// Initialize default data
export const initializeStorage = () => {
  // Set default admin password if not exists
  if (!localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD)) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, '1234');
  }

  // Initialize meeting rooms
  if (!localStorage.getItem(STORAGE_KEYS.MEETING_ROOMS)) {
    const defaultRooms = [
      { id: '1', name: 'Conference Room A', capacity: 10, floor: '3F' },
      { id: '2', name: 'Conference Room B', capacity: 6, floor: '3F' },
      { id: '3', name: 'Meeting Room 1', capacity: 4, floor: '2F' },
      { id: '4', name: 'Meeting Room 2', capacity: 4, floor: '2F' },
    ];
    localStorage.setItem(STORAGE_KEYS.MEETING_ROOMS, JSON.stringify(defaultRooms));
  }

  // Initialize other data structures
  if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RESERVATIONS)) {
    localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VOLUNTEER_ACTIVITIES)) {
    localStorage.setItem(STORAGE_KEYS.VOLUNTEER_ACTIVITIES, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.VOLUNTEER_REGISTRATIONS)) {
    localStorage.setItem(STORAGE_KEYS.VOLUNTEER_REGISTRATIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUPPLY_REQUESTS)) {
    localStorage.setItem(STORAGE_KEYS.SUPPLY_REQUESTS, JSON.stringify([]));
  }
};

// Generic storage functions
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

// Generate unique ID
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Posts
export const getPosts = () => getItem(STORAGE_KEYS.POSTS) || [];
export const addPost = (post) => {
  const posts = getPosts();
  const newPost = {
    id: generateId(),
    ...post,
    timestamp: new Date().toISOString(),
  };
  posts.unshift(newPost);
  setItem(STORAGE_KEYS.POSTS, posts);
  return newPost;
};

// Meeting Rooms
export const getMeetingRooms = () => getItem(STORAGE_KEYS.MEETING_ROOMS) || [];
export const addMeetingRoom = (room) => {
  const rooms = getMeetingRooms();
  const newRoom = { id: generateId(), ...room };
  rooms.push(newRoom);
  setItem(STORAGE_KEYS.MEETING_ROOMS, rooms);
  return newRoom;
};
export const deleteMeetingRoom = (roomId) => {
  const rooms = getMeetingRooms();
  const filtered = rooms.filter(r => r.id !== roomId);
  setItem(STORAGE_KEYS.MEETING_ROOMS, filtered);
};

// Reservations
export const getReservations = () => getItem(STORAGE_KEYS.RESERVATIONS) || [];
export const addReservation = (reservation) => {
  const reservations = getReservations();
  const newReservation = {
    id: generateId(),
    ...reservation,
    createdAt: new Date().toISOString(),
  };
  reservations.push(newReservation);
  setItem(STORAGE_KEYS.RESERVATIONS, reservations);
  return newReservation;
};
export const deleteReservation = (reservationId) => {
  const reservations = getReservations();
  const filtered = reservations.filter(r => r.id !== reservationId);
  setItem(STORAGE_KEYS.RESERVATIONS, filtered);
};

// Volunteer Activities
export const getVolunteerActivities = () => getItem(STORAGE_KEYS.VOLUNTEER_ACTIVITIES) || [];
export const addVolunteerActivity = (activity) => {
  const activities = getVolunteerActivities();
  const newActivity = {
    id: generateId(),
    ...activity,
    createdAt: new Date().toISOString(),
    participants: [],
    status: 'open', // open, closed, completed
    deadline: activity.deadline || null, // 모집 마감일
    isPublished: false, // 탭1에 게시 여부
    publishedAt: null, // 게시 시작 시간
    publishDuration: 24 * 60 * 60 * 1000, // 24시간 (밀리초)
  };
  activities.push(newActivity);
  setItem(STORAGE_KEYS.VOLUNTEER_ACTIVITIES, activities);
  return newActivity;
};
export const updateVolunteerActivity = (activityId, updates) => {
  const activities = getVolunteerActivities();
  const updated = activities.map(a => a.id === activityId ? { ...a, ...updates } : a);
  setItem(STORAGE_KEYS.VOLUNTEER_ACTIVITIES, updated);
};
export const deleteVolunteerActivity = (activityId) => {
  const activities = getVolunteerActivities();
  const filtered = activities.filter(a => a.id !== activityId);
  setItem(STORAGE_KEYS.VOLUNTEER_ACTIVITIES, filtered);
};

// Volunteer Registrations
export const getVolunteerRegistrations = () => getItem(STORAGE_KEYS.VOLUNTEER_REGISTRATIONS) || [];
export const addVolunteerRegistration = (registration) => {
  const registrations = getVolunteerRegistrations();
  const newRegistration = {
    id: generateId(),
    ...registration,
    registeredAt: new Date().toISOString(),
    status: 'pending', // pending, confirmed, rejected
  };
  registrations.push(newRegistration);
  setItem(STORAGE_KEYS.VOLUNTEER_REGISTRATIONS, registrations);
  return newRegistration;
};
export const updateVolunteerRegistration = (registrationId, updates) => {
  const registrations = getVolunteerRegistrations();
  const updated = registrations.map(r => r.id === registrationId ? { ...r, ...updates } : r);
  setItem(STORAGE_KEYS.VOLUNTEER_REGISTRATIONS, updated);
};

// Supply Requests
export const getSupplyRequests = () => getItem(STORAGE_KEYS.SUPPLY_REQUESTS) || [];
export const addSupplyRequest = (request) => {
  const requests = getSupplyRequests();
  const newRequest = {
    id: generateId(),
    ...request,
    createdAt: new Date().toISOString(),
    status: 'pending', // pending, approved, rejected
  };
  requests.push(newRequest);
  setItem(STORAGE_KEYS.SUPPLY_REQUESTS, requests);
  return newRequest;
};
export const updateSupplyRequest = (requestId, updates) => {
  const requests = getSupplyRequests();
  const updated = requests.map(r => r.id === requestId ? { ...r, ...updates } : r);
  setItem(STORAGE_KEYS.SUPPLY_REQUESTS, updated);
};
