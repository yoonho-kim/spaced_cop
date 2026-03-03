/* global process */
import { createClient } from '@supabase/supabase-js';
import {
  applyCors,
  createSessionToken,
  enforceRateLimit,
  requireSession,
  setSessionCookie,
} from './_security.js';

const SESSION_TTL_SECONDS = 10 * 60 * 60;

const buildSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseServerKey) return null;

  return createClient(supabaseUrl, supabaseServerKey, {
    auth: { persistSession: false },
  });
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'GET,OPTIONS' })) {
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  if (!enforceRateLimit(request, response, { key: 'auth-session', max: 60, windowMs: 15 * 60_000 })) {
    return;
  }

  const session = requireSession(request, response);
  if (!session) return;

  const supabase = buildSupabaseClient();
  if (!supabase) {
    response.status(500).json({
      success: false,
      error: 'SUPABASE 연결 환경변수가 설정되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY 또는 VITE_SUPABASE_ANON_KEY 필요)',
    });
    return;
  }

  try {
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, nickname, employee_id, gender, profile_icon_url, is_admin')
      .eq('id', session.uid)
      .maybeSingle();

    if (error || !dbUser) {
      response.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const token = createSessionToken(
      {
        uid: dbUser.id,
        nickname: dbUser.nickname,
        isAdmin: dbUser.is_admin === true,
      },
      process.env.API_SESSION_SECRET,
      SESSION_TTL_SECONDS,
    );
    setSessionCookie(request, response, token, SESSION_TTL_SECONDS);

    response.status(200).json({
      success: true,
      user: {
        id: dbUser.id,
        nickname: dbUser.nickname,
        employeeId: dbUser.employee_id,
        gender: dbUser.gender,
        profileIconUrl: dbUser.profile_icon_url,
        isAdmin: dbUser.is_admin === true,
        isRegistered: true,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Auth session error:', error);
    response.status(500).json({
      success: false,
      error: '세션 확인 중 오류가 발생했습니다.',
    });
  }
}
