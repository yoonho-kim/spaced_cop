import { supabase } from './supabase';

// Storage keys (kept for backward compatibility with admin password)
export const STORAGE_KEYS = {
  USER: 'spaced_user',
  ADMIN_PASSWORD: 'spaced_admin_password',
};

// Initialize default data
export const initializeStorage = async () => {
  // Set default admin password if not exists (still using localStorage)
  if (!localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD)) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, '1234');
  }

  // Check if meeting rooms exist, if not, initialize them
  const { data: rooms } = await supabase.from('meeting_rooms').select('id').limit(1);
  if (!rooms || rooms.length === 0) {
    const defaultRooms = [
      { name: 'Conference Room A', capacity: 10, floor: '3F' },
      { name: 'Conference Room B', capacity: 6, floor: '3F' },
      { name: 'Meeting Room 1', capacity: 4, floor: '2F' },
      { name: 'Meeting Room 2', capacity: 4, floor: '2F' },
    ];
    await supabase.from('meeting_rooms').insert(defaultRooms);
  }
};

// Generic storage functions (for localStorage compatibility)
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

// ============================================
// POSTS
// ============================================

export const getPosts = async () => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      post_likes(user_nickname),
      post_comments(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  // Transform data to match existing structure
  return data.map(post => ({
    id: post.id,
    content: post.content,
    author: post.author_nickname,
    isAdmin: post.is_admin,
    postType: post.post_type || 'normal',
    timestamp: post.created_at,
    likes: post.post_likes?.map(like => like.user_nickname) || [],
    comments: post.post_comments?.map(comment => ({
      id: comment.id,
      userName: comment.user_nickname,
      content: comment.content,
      timestamp: comment.created_at,
    })) || [],
  }));
};

export const addPost = async (post) => {
  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        author_nickname: post.author,
        content: post.content,
        is_admin: post.isAdmin || false,
        post_type: post.postType || 'normal',
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding post:', error);
    return null;
  }

  return {
    id: data.id,
    content: data.content,
    author: data.author_nickname,
    isAdmin: data.is_admin,
    postType: data.post_type,
    timestamp: data.created_at,
    likes: [],
    comments: [],
  };
};

// ============================================
// LIKES
// ============================================

export const addLike = async (postId, userName) => {
  const { error } = await supabase
    .from('post_likes')
    .insert([{ post_id: postId, user_nickname: userName }]);

  if (error) {
    console.error('Error adding like:', error);
  }
};

export const removeLike = async (postId, userName) => {
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .match({ post_id: postId, user_nickname: userName });

  if (error) {
    console.error('Error removing like:', error);
  }
};

// ============================================
// COMMENTS
// ============================================

export const addComment = async (postId, userName, content) => {
  const { error } = await supabase
    .from('post_comments')
    .insert([
      {
        post_id: postId,
        user_nickname: userName,
        content: content,
      }
    ]);

  if (error) {
    console.error('Error adding comment:', error);
  }
};

// ============================================
// MEETING ROOMS
// ============================================

export const getMeetingRooms = async () => {
  const { data, error } = await supabase
    .from('meeting_rooms')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching meeting rooms:', error);
    return [];
  }

  return data.map(room => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    floor: room.floor,
  }));
};

export const addMeetingRoom = async (room) => {
  const { data, error } = await supabase
    .from('meeting_rooms')
    .insert([room])
    .select()
    .single();

  if (error) {
    console.error('Error adding meeting room:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    capacity: data.capacity,
    floor: data.floor,
  };
};

export const deleteMeetingRoom = async (roomId) => {
  const { error } = await supabase
    .from('meeting_rooms')
    .delete()
    .match({ id: roomId });

  if (error) {
    console.error('Error deleting meeting room:', error);
  }
};

// ============================================
// RESERVATIONS
// ============================================

export const getReservations = async () => {
  const { data, error } = await supabase
    .from('meeting_reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reservations:', error);
    return [];
  }

  return data.map(reservation => ({
    id: reservation.id,
    roomId: reservation.room_id,
    roomName: reservation.room_name,
    userName: reservation.user_nickname,
    date: reservation.date,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    department: reservation.department,
    purpose: reservation.purpose,
    createdAt: reservation.created_at,
  }));
};

export const addReservation = async (reservation) => {
  const { data, error } = await supabase
    .from('meeting_reservations')
    .insert([
      {
        room_id: reservation.roomId,
        room_name: reservation.roomName,
        user_nickname: reservation.userName,
        date: reservation.date,
        start_time: reservation.startTime,
        end_time: reservation.endTime,
        department: reservation.department,
        purpose: reservation.purpose,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding reservation:', error);
    return null;
  }

  return {
    id: data.id,
    roomId: data.room_id,
    roomName: data.room_name,
    userName: data.user_nickname,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time,
    department: data.department,
    purpose: data.purpose,
    createdAt: data.created_at,
  };
};

export const deleteReservation = async (reservationId) => {
  const { error } = await supabase
    .from('meeting_reservations')
    .delete()
    .match({ id: reservationId });

  if (error) {
    console.error('Error deleting reservation:', error);
  }
};

// ============================================
// VOLUNTEER ACTIVITIES
// ============================================

export const getVolunteerActivities = async () => {
  const { data, error } = await supabase
    .from('volunteer_activities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching volunteer activities:', error);
    return [];
  }

  return data.map(activity => ({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    date: activity.date,
    deadline: activity.deadline,
    maxParticipants: activity.max_participants,
    location: activity.location,
    imageUrl: activity.image_url,
    status: activity.status,
    isPublished: activity.is_published,
    publishedAt: activity.published_at,
    publishDuration: activity.publish_duration,
    createdAt: activity.created_at,
  }));
};

export const addVolunteerActivity = async (activity) => {
  const { data, error } = await supabase
    .from('volunteer_activities')
    .insert([
      {
        title: activity.title,
        description: activity.description,
        date: activity.date,
        deadline: activity.deadline || null,
        max_participants: activity.maxParticipants,
        location: activity.location || null,
        image_url: activity.imageUrl || null,
        status: 'open',
        is_published: false,
        published_at: null,
        publish_duration: 86400000, // 24 hours in milliseconds
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding volunteer activity:', error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    date: data.date,
    deadline: data.deadline,
    maxParticipants: data.max_participants,
    location: data.location,
    imageUrl: data.image_url,
    status: data.status,
    isPublished: data.is_published,
    publishedAt: data.published_at,
    publishDuration: data.publish_duration,
    createdAt: data.created_at,
  };
};

export const updateVolunteerActivity = async (activityId, updates) => {
  // Transform camelCase to snake_case
  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.isPublished !== undefined) dbUpdates.is_published = updates.isPublished;
  if (updates.publishedAt !== undefined) dbUpdates.published_at = updates.publishedAt;

  const { error } = await supabase
    .from('volunteer_activities')
    .update(dbUpdates)
    .match({ id: activityId });

  if (error) {
    console.error('Error updating volunteer activity:', error);
  }
};

export const deleteVolunteerActivity = async (activityId) => {
  const { error } = await supabase
    .from('volunteer_activities')
    .delete()
    .match({ id: activityId });

  if (error) {
    console.error('Error deleting volunteer activity:', error);
  }
};

// ============================================
// VOLUNTEER REGISTRATIONS
// ============================================

export const getVolunteerRegistrations = async () => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching volunteer registrations:', error);
    return [];
  }

  return data.map(registration => ({
    id: registration.id,
    activityId: registration.activity_id,
    activityTitle: registration.activity_title,
    userName: registration.user_nickname,
    employeeId: registration.employee_id,
    status: registration.status,
    registeredAt: registration.created_at,
  }));
};

export const addVolunteerRegistration = async (registration) => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .insert([
      {
        activity_id: registration.activityId,
        activity_title: registration.activityTitle,
        user_nickname: registration.userName,
        employee_id: registration.employeeId,
        status: 'pending',
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding volunteer registration:', error);
    return null;
  }

  return {
    id: data.id,
    activityId: data.activity_id,
    activityTitle: data.activity_title,
    userName: data.user_nickname,
    employeeId: data.employee_id,
    status: data.status,
    registeredAt: data.created_at,
  };
};

export const updateVolunteerRegistration = async (registrationId, updates) => {
  const { error } = await supabase
    .from('volunteer_registrations')
    .update(updates)
    .match({ id: registrationId });

  if (error) {
    console.error('Error updating volunteer registration:', error);
  }
};

// ============================================
// SUPPLY REQUESTS
// ============================================

export const getSupplyRequests = async () => {
  const { data, error } = await supabase
    .from('supply_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching supply requests:', error);
    return [];
  }

  return data.map(request => ({
    id: request.id,
    userName: request.user_nickname,
    itemName: request.item_name,
    quantity: request.quantity,
    reason: request.reason,
    status: request.status,
    adminNote: request.admin_note,
    createdAt: request.created_at,
  }));
};

export const addSupplyRequest = async (request) => {
  const { data, error } = await supabase
    .from('supply_requests')
    .insert([
      {
        user_nickname: request.userName,
        item_name: request.itemName,
        quantity: request.quantity,
        reason: request.reason || null,
        status: 'pending',
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding supply request:', error);
    return null;
  }

  return {
    id: data.id,
    userName: data.user_nickname,
    itemName: data.item_name,
    quantity: data.quantity,
    reason: data.reason,
    status: data.status,
    adminNote: data.admin_note,
    createdAt: data.created_at,
  };
};

export const updateSupplyRequest = async (requestId, updates) => {
  // Transform camelCase to snake_case
  const dbUpdates = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.adminNote !== undefined) dbUpdates.admin_note = updates.adminNote;

  const { error } = await supabase
    .from('supply_requests')
    .update(dbUpdates)
    .match({ id: requestId });

  if (error) {
    console.error('Error updating supply request:', error);
  }
};
