/* global process */
import { createClient } from '@supabase/supabase-js';

const KST_TIME_ZONE = 'Asia/Seoul';

const buildKstParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
};

const getKstYear = (isoTimestamp) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(isoTimestamp));
  return Number(parts.find((p) => p.type === 'year')?.value || 0);
};

const formatVolunteerDateLabel = (dateString) => {
  if (!dateString) return '00월 00일';
  const [year, month, day] = String(dateString).split('-').map((v) => Number(v));
  if (!year || !month || !day) return '00월 00일';
  return `${String(month).padStart(2, '0')}월 ${String(day).padStart(2, '0')}일`;
};

const buildLotteryFeedContent = (title, activityDate) =>
  `${title} 의 추첨이 완료되었습니다.\n - 봉사활동 일자 : ${formatVolunteerDateLabel(activityDate)}`;

const setCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

const isAuthorizedCronRequest = (request, cronSecret) => {
  const authHeader = request.headers?.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return !!cronSecret && !!bearerToken && bearerToken === cronSecret;
};

export default async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (!['GET', 'POST'].includes(request.method || '')) {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    response.status(500).json({ success: false, error: 'CRON_SECRET 환경변수가 없습니다.' });
    return;
  }

  if (!isAuthorizedCronRequest(request, cronSecret)) {
    response.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({
      success: false,
      error: 'VITE_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.',
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const nowKst = buildKstParts(new Date());
  const forceRun = String(request.query?.force || '').toLowerCase() === '1';

  // 기본 동작은 KST 09시 자동 실행이며, force=1 호출 시 시간 검사 없이 실행합니다.
  if (!forceRun && nowKst.hour !== '09') {
    response.status(200).json({
      success: true,
      skipped: true,
      reason: `현재 KST ${nowKst.hour}시 (자동 추첨 시간 아님)`,
      kstDate: nowKst.dateKey,
    });
    return;
  }

  try {
    const { data: openActivities, error: activityError } = await supabase
      .from('volunteer_activities')
      .select('id, title, date, deadline, max_participants, status, is_published')
      .eq('status', 'open')
      .eq('deadline', nowKst.dateKey);

    if (activityError) {
      throw activityError;
    }

    if (!openActivities || openActivities.length === 0) {
      response.status(200).json({
        success: true,
        processedActivities: 0,
        processedRegistrations: 0,
        message: '오늘 마감되는 모집중 봉사활동이 없습니다.',
      });
      return;
    }

    const activityIds = openActivities.map((activity) => activity.id);
    const { data: pendingRegs, error: pendingError } = await supabase
      .from('volunteer_registrations')
      .select('id, activity_id, employee_id, created_at')
      .in('activity_id', activityIds)
      .eq('status', 'pending');

    if (pendingError) {
      throw pendingError;
    }

    const { data: confirmedRegs, error: confirmedError } = await supabase
      .from('volunteer_registrations')
      .select('employee_id, created_at')
      .eq('status', 'confirmed');

    if (confirmedError) {
      throw confirmedError;
    }

    const currentKstYear = Number(nowKst.year);
    const confirmedCountByEmployee = new Map();

    (confirmedRegs || []).forEach((reg) => {
      if (!reg.employee_id) return;
      if (getKstYear(reg.created_at) !== currentKstYear) return;
      const prev = confirmedCountByEmployee.get(reg.employee_id) || 0;
      confirmedCountByEmployee.set(reg.employee_id, prev + 1);
    });

    let processedActivities = 0;
    let processedRegistrations = 0;
    const details = [];

    for (const activity of openActivities) {
      const candidates = (pendingRegs || []).filter((reg) => reg.activity_id === activity.id);
      if (candidates.length === 0) {
        details.push({
          activityId: activity.id,
          title: activity.title,
          skipped: true,
          reason: 'pending 신청자 없음',
        });
        continue;
      }

      const maxParticipants = Number(activity.max_participants || 0);

      let winners = [];
      let losers = [];

      if (candidates.length <= maxParticipants) {
        winners = candidates;
      } else {
        const ranked = [...candidates].sort((a, b) => {
          const countA = confirmedCountByEmployee.get(a.employee_id) || 0;
          const countB = confirmedCountByEmployee.get(b.employee_id) || 0;
          if (countA !== countB) return countA - countB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        winners = ranked.slice(0, maxParticipants);
        losers = ranked.slice(maxParticipants);
      }

      if (winners.length > 0) {
        const { error } = await supabase
          .from('volunteer_registrations')
          .update({ status: 'confirmed' })
          .in('id', winners.map((w) => w.id));
        if (error) throw error;
      }

      if (losers.length > 0) {
        const { error } = await supabase
          .from('volunteer_registrations')
          .update({ status: 'rejected' })
          .in('id', losers.map((l) => l.id));
        if (error) throw error;
      }

      const publishedAt = new Date().toISOString();
      const { error: closeError } = await supabase
        .from('volunteer_activities')
        .update({
          status: 'closed',
          is_published: true,
          published_at: publishedAt,
        })
        .eq('id', activity.id);
      if (closeError) throw closeError;

      const announcement = buildLotteryFeedContent(activity.title, activity.date);
      const { error: postError } = await supabase
        .from('posts')
        .insert([{
          author_nickname: 'admin',
          content: announcement,
          is_admin: true,
          post_type: 'volunteer',
        }]);
      if (postError) throw postError;

      processedActivities += 1;
      processedRegistrations += winners.length + losers.length;
      details.push({
        activityId: activity.id,
        title: activity.title,
        winners: winners.length,
        rejected: losers.length,
        maxParticipants,
      });
    }

    response.status(200).json({
      success: true,
      kstDate: nowKst.dateKey,
      processedActivities,
      processedRegistrations,
      details,
    });
  } catch (error) {
    console.error('Volunteer auto lottery failed:', error);
    response.status(500).json({
      success: false,
      error: error?.message || '자동 추첨 처리 중 오류가 발생했습니다.',
    });
  }
}
