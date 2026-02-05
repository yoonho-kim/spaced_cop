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
    //await supabase.from('meeting_rooms').insert(defaultRooms);
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
// EVENT SETTINGS
// ============================================

export const getEventSettings = async () => {
  const { data, error } = await supabase
    .from('app_event_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    // No rows found
    if (error.code === 'PGRST116') {
      return {
        id: 1,
        isActive: false,
        description: '',
        imageUrl: '',
        imagePath: '',
        updatedAt: null,
      };
    }
    console.error('Error fetching event settings:', error);
    return null;
  }

  return {
    id: data.id,
    isActive: data.is_active,
    description: data.description || '',
    imageUrl: data.image_url || '',
    imagePath: data.image_path || '',
    updatedAt: data.updated_at || data.created_at || null,
  };
};

export const upsertEventSettings = async (settings) => {
  const payload = {
    id: 1,
    is_active: !!settings.isActive,
    description: settings.description || '',
    image_url: settings.imageUrl || '',
    image_path: settings.imagePath || '',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('app_event_settings')
    .upsert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error updating event settings:', error);
    return { success: false, error: '이벤트 설정을 저장할 수 없습니다.' };
  }

  return { success: true, data };
};

export const uploadEventImage = async (file) => {
  if (!file) {
    return { success: false, error: '이미지 파일이 없습니다.' };
  }

  const safeName = file.name.replace(/[^\w.-]+/g, '-');
  const path = `events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage
    .from('event-img')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    console.error('Error uploading event image:', error);
    return { success: false, error: '이미지 업로드에 실패했습니다.' };
  }

  const { data } = supabase.storage.from('event-img').getPublicUrl(path);
  return { success: true, publicUrl: data.publicUrl, path };
};

export const deleteEventImage = async (path) => {
  if (!path) return { success: true };

  const { error } = await supabase.storage.from('event-img').remove([path]);
  if (error) {
    console.error('Error deleting event image:', error);
    return { success: false, error: '이미지 삭제에 실패했습니다.' };
  }

  return { success: true };
};

export const getEventKey = (eventSettings) => {
  if (!eventSettings) return 'default';
  return eventSettings.updatedAt || eventSettings.id || 'default';
};

// ============================================
// EVENT ENTRIES
// ============================================

const mapEventEntry = (entry) => ({
  id: entry.id,
  eventKey: entry.event_key,
  employeeId: entry.employee_id,
  nickname: entry.nickname,
  result: entry.result,
  isWinner: entry.is_winner,
  boxIndex: entry.box_index,
  createdAt: entry.created_at,
});

export const getEventEntryForEmployee = async (eventKey, employeeId) => {
  if (!eventKey || !employeeId) return null;

  const { data, error } = await supabase
    .from('app_event_entries')
    .select('*')
    .eq('event_key', eventKey)
    .eq('employee_id', employeeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching event entry:', error);
    return null;
  }

  return mapEventEntry(data);
};

export const getEventEntries = async (eventKey) => {
  if (!eventKey) return [];

  const { data, error } = await supabase
    .from('app_event_entries')
    .select('*')
    .eq('event_key', eventKey)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching event entries:', error);
    return [];
  }

  return (data || []).map(mapEventEntry);
};

export const addEventEntry = async (entry) => {
  const { data, error } = await supabase
    .from('app_event_entries')
    .insert([
      {
        event_key: entry.eventKey,
        employee_id: entry.employeeId,
        nickname: entry.nickname || null,
        result: entry.result,
        is_winner: !!entry.isWinner,
        box_index: entry.boxIndex ?? null,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding event entry:', error);
    return { success: false, error };
  }

  return { success: true, entry: mapEventEntry(data) };
};

// ============================================
// POSTS
// ============================================

const buildPosts = async (data) => {
  const safeData = data || [];
  if (safeData.length === 0) return [];

  // Get all unique author nicknames to fetch their profile icons
  const authorNicknames = [
    ...new Set(safeData.map(post => post.author_nickname).filter(Boolean))
  ];

  // Fetch user profile icons
  let usersData = [];
  if (authorNicknames.length > 0) {
    const { data: fetchedUsers } = await supabase
      .from('users')
      .select('nickname, profile_icon_url')
      .in('nickname', authorNicknames);
    usersData = fetchedUsers || [];
  }

  // Create a map of nickname to profile icon URL
  const userIconMap = {};
  usersData.forEach(user => {
    userIconMap[user.nickname] = user.profile_icon_url;
  });

  // Transform data to match existing structure
  return safeData.map(post => ({
    id: post.id,
    content: post.content,
    author: post.author_nickname,
    authorIconUrl: userIconMap[post.author_nickname] || null,
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

  return await buildPosts(data);
};

export const getPostsPage = async ({ limit = 10, offset = 0 } = {}) => {
  const fetchLimit = limit + 1;
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      post_likes(user_nickname),
      post_comments(*)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  if (error) {
    console.error('Error fetching paged posts:', error);
    return { posts: [], hasMore: false };
  }

  const hasMore = (data || []).length > limit;
  const pageData = hasMore ? data.slice(0, limit) : data;
  const posts = await buildPosts(pageData);

  return { posts, hasMore };
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

export const deletePost = async (postId) => {
  const { error } = await supabase
    .from('posts')
    .delete()
    .match({ id: postId });

  if (error) {
    console.error('Error deleting post:', error);
  }
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
    recognitionHours: activity.recognition_hours,
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
        recognition_hours: activity.recognitionHours || 0,
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
    recognitionHours: data.recognition_hours,
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

// ============================================
// TOP VOLUNTEERS (for badge display)
// ============================================

export const getTop3Volunteers = async () => {
  const currentYear = new Date().getFullYear();

  // Get all confirmed registrations for the current year
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('*')
    .eq('status', 'confirmed');

  if (error) {
    console.error('Error fetching top volunteers:', error);
    return [];
  }

  // Filter for current year
  const yearRegistrations = data.filter(r => {
    const regYear = new Date(r.created_at).getFullYear();
    return regYear === currentYear;
  });

  // Group by employee_id and count
  const employeeStats = {};
  yearRegistrations.forEach(r => {
    if (!r.employee_id) return;

    if (!employeeStats[r.employee_id]) {
      employeeStats[r.employee_id] = {
        employeeId: r.employee_id,
        count: 0,
        lastNickname: r.user_nickname,
        lastRegisteredAt: r.created_at
      };
    }

    employeeStats[r.employee_id].count += 1;

    // Update to the latest nickname
    if (new Date(r.created_at) > new Date(employeeStats[r.employee_id].lastRegisteredAt)) {
      employeeStats[r.employee_id].lastNickname = r.user_nickname;
      employeeStats[r.employee_id].lastRegisteredAt = r.created_at;
    }
  });

  // Get top 3 by count
  const top3 = Object.values(employeeStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(v => v.lastNickname);

  return top3;
};

// ============================================
// ADMIN VOLUNTEER STATISTICS
// ============================================

// 사용자별 봉사 통계
export const getVolunteerStatsByUser = async () => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select(`
      *,
      volunteer_activities(title, date)
    `)
    .eq('status', 'confirmed');

  if (error) {
    console.error('Error fetching volunteer stats by user:', error);
    return [];
  }

  // Group by employee_id
  const userStats = {};
  data.forEach(reg => {
    const empId = reg.employee_id || 'unknown';
    if (!userStats[empId]) {
      userStats[empId] = {
        employeeId: empId,
        employeeName: reg.employee_name || reg.user_nickname || '-',
        totalParticipations: 0,
        totalHours: 0,
        activities: []
      };
    }
    userStats[empId].totalParticipations += 1;
    userStats[empId].totalHours += parseFloat(reg.recognized_hours || 0);
    if (reg.volunteer_activities?.title) {
      userStats[empId].activities.push(reg.volunteer_activities.title);
    }
  });

  // Convert to array and format
  return Object.values(userStats)
    .map(u => ({
      ...u,
      totalHours: Math.round(u.totalHours * 10) / 10,
      activityList: [...new Set(u.activities)].join(', ')
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
};

// 봉사활동별 통계 (참여인원, 모집률)
export const getVolunteerStatsByActivity = async () => {
  const { data: activities, error: actError } = await supabase
    .from('volunteer_activities')
    .select('*')
    .order('created_at', { ascending: false });

  if (actError) {
    console.error('Error fetching activities:', actError);
    return [];
  }

  const { data: registrations, error: regError } = await supabase
    .from('volunteer_registrations')
    .select('*')
    .eq('status', 'confirmed');

  if (regError) {
    console.error('Error fetching registrations:', regError);
    return [];
  }

  // Count registrations per activity
  const regCounts = {};
  registrations.forEach(reg => {
    regCounts[reg.activity_id] = (regCounts[reg.activity_id] || 0) + 1;
  });

  return activities.map(act => {
    const participantCount = regCounts[act.id] || 0;
    const maxParticipants = act.max_participants || 0;
    const fillRate = maxParticipants > 0
      ? Math.round((participantCount / maxParticipants) * 100)
      : 0;

    return {
      id: act.id,
      title: act.title,
      date: act.date,
      maxParticipants,
      participantCount,
      fillRate
    };
  });
};

// 월별 참여 통계
export const getMonthlyVolunteerStats = async () => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('*')
    .eq('status', 'confirmed');

  if (error) {
    console.error('Error fetching monthly stats:', error);
    return [];
  }

  // Group by month
  const monthlyStats = {};
  data.forEach(reg => {
    const date = new Date(reg.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {
        month: monthKey,
        participantCount: 0,
        uniqueParticipants: new Set(),
        totalHours: 0
      };
    }
    monthlyStats[monthKey].participantCount += 1;
    monthlyStats[monthKey].uniqueParticipants.add(reg.employee_id);
    monthlyStats[monthKey].totalHours += parseFloat(reg.recognized_hours || 0);
  });

  return Object.values(monthlyStats)
    .map(m => ({
      month: m.month,
      participantCount: m.participantCount,
      uniqueParticipants: m.uniqueParticipants.size,
      totalHours: Math.round(m.totalHours * 10) / 10
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

// 특정 활동의 참가자 목록
export const getActivityParticipants = async (activityId) => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching participants:', error);
    return [];
  }

  return data.map(reg => ({
    id: reg.id,
    activityId: reg.activity_id,
    employeeId: reg.employee_id,
    employeeName: reg.employee_name || reg.user_nickname,
    userName: reg.user_nickname,
    status: reg.status,
    recognizedHours: reg.recognized_hours || 0,
    registeredAt: reg.created_at
  }));
};

// ============================================
// RECURRING RESERVATIONS
// ============================================

export const getRecurringRules = async () => {
  const { data, error } = await supabase
    .from('meeting_recurring_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recurring rules:', error);
    return [];
  }

  return data.map(rule => ({
    id: rule.id,
    roomId: rule.room_id,
    roomName: rule.room_name,
    ruleType: rule.rule_type,
    dayOfWeek: rule.day_of_week,
    weekOfMonth: rule.week_of_month,
    startTime: rule.start_time,
    endTime: rule.end_time,
    department: rule.department,
    purpose: rule.purpose,
    createdAt: rule.created_at
  }));
};

export const addRecurringRule = async (rule) => {
  // 1. 규칙 저장
  const { data, error } = await supabase
    .from('meeting_recurring_rules')
    .insert([{
      room_id: rule.roomId,
      room_name: rule.roomName,
      rule_type: rule.ruleType,
      day_of_week: rule.dayOfWeek,
      week_of_month: rule.weekOfMonth,
      start_time: rule.startTime,
      end_time: rule.endTime,
      department: rule.department,
      purpose: rule.purpose
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding recurring rule:', error);
    throw error;
  }

  // 2. 예약 확장 (1년치 생성)
  await expandRecurringReservations(data);

  return data;
};

export const deleteRecurringRule = async (ruleId) => {
  // ON DELETE CASCADE 설정으로 인해 규칙 삭제 시 관련 예약들도 자동 삭제됨 (DB 레벨)
  const { error } = await supabase
    .from('meeting_recurring_rules')
    .delete()
    .match({ id: ruleId });

  if (error) {
    console.error('Error deleting recurring rule:', error);
    throw error;
  }
};

// Helper to expand rules into actual reservations
const expandRecurringReservations = async (rule) => {
  const reservations = [];
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(startDate.getFullYear() + 1); // 1년치

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    let match = false;

    if (rule.rule_type === 'weekly') {
      if (currentDate.getDay() === rule.day_of_week) {
        match = true;
      }
    } else if (rule.rule_type === 'monthly') {
      // 매월 N째주 X요일
      if (currentDate.getDay() === rule.day_of_week) {
        const weekNum = Math.ceil(currentDate.getDate() / 7);
        if (weekNum === rule.week_of_month) {
          match = true;
        }
      }
    }

    if (match) {
      const dateStr = currentDate.toISOString().split('T')[0];
      reservations.push({
        room_id: rule.room_id,
        room_name: rule.room_name,
        user_nickname: '시스템(반복예약)',
        date: dateStr,
        start_time: rule.start_time,
        end_time: rule.end_time,
        department: rule.department,
        purpose: rule.purpose,
        recurring_rule_id: rule.id
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 일괄 삽입 시 중복 체크
  const { data: existingReservations } = await supabase
    .from('meeting_reservations')
    .select('room_id, date, start_time, end_time')
    .eq('room_id', rule.room_id);

  const isConflicting = (newRes) => {
    return existingReservations?.some(existing => {
      if (existing.date !== newRes.date) return false;

      const newStart = parseInt(newRes.start_time);
      const newEnd = parseInt(newRes.end_time);
      const existingStart = parseInt(existing.start_time);
      const existingEnd = parseInt(existing.end_time);

      // Overlap condition: (StartA < EndB) and (EndA > StartB)
      return (newStart < existingEnd) && (newEnd > existingStart);
    });
  };

  // 중복되지 않은 예약들만 필터링
  const newReservations = reservations.filter(res => !isConflicting(res));

  if (newReservations.length > 0) {
    const { error } = await supabase
      .from('meeting_reservations')
      .insert(newReservations);

    if (error) {
      console.error('Error expanding recurring reservations:', error);
    }
  }
};

// 관리자가 참가자 추가
export const addParticipantByAdmin = async (activityId, activityTitle, employeeId, employeeName, hours) => {
  const { data, error } = await supabase
    .from('volunteer_registrations')
    .insert([{
      activity_id: activityId,
      activity_title: activityTitle,
      employee_id: employeeId,
      employee_name: employeeName,
      user_nickname: employeeName,
      status: 'confirmed',
      recognized_hours: hours || 0
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding participant:', error);
    return null;
  }

  return data;
};

// 참가자 정보 수정 (인정시간, 이름, 사번)
export const updateParticipantDetails = async (registrationId, updates) => {
  const dbUpdates = {};
  if (updates.hours !== undefined) dbUpdates.recognized_hours = updates.hours;
  if (updates.employeeName) dbUpdates.employee_name = updates.employeeName;
  if (updates.employeeId) dbUpdates.employee_id = updates.employeeId;

  const { error } = await supabase
    .from('volunteer_registrations')
    .update(dbUpdates)
    .match({ id: registrationId });

  if (error) {
    console.error('Error updating participant hours:', error);
    return false;
  }
  return true;
};

// 참가자 삭제
export const deleteVolunteerRegistration = async (registrationId) => {
  const { error } = await supabase
    .from('volunteer_registrations')
    .delete()
    .match({ id: registrationId });

  if (error) {
    console.error('Error deleting registration:', error);
    return false;
  }
  return true;
};
