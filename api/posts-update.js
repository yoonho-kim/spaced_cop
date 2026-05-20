/* global process */
import { createClient } from '@supabase/supabase-js';
import {
  applyCors,
  enforceRateLimit,
  parseRequestBody,
  requireSession,
} from './_security.js';

const buildSupabaseAdminClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

export default async function handler(request, response) {
  if (!applyCors(request, response, { methods: 'POST,OPTIONS' })) {
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  const session = requireSession(request, response);
  if (!session) return;

  if (!enforceRateLimit(request, response, { key: `posts-update:${session.uid}`, max: 30, windowMs: 60_000 })) {
    return;
  }

  const supabase = buildSupabaseAdminClient();
  if (!supabase) {
    response.status(500).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.',
    });
    return;
  }

  try {
    const body = parseRequestBody(request);
    const postId = String(body?.postId || '').trim();
    const content = String(body?.content || '').trim();

    if (!postId) {
      response.status(400).json({ success: false, error: '게시물 ID가 없습니다.' });
      return;
    }

    if (!content) {
      response.status(400).json({ success: false, error: '내용이 비어 있습니다.' });
      return;
    }

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, author_nickname')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!post) {
      response.status(404).json({ success: false, error: '게시물을 찾을 수 없습니다.' });
      return;
    }

    const sessionNickname = String(session.nickname || '').trim();
    const authorNickname = String(post.author_nickname || '').trim();
    const canUpdate = session.isAdmin === true || (sessionNickname && authorNickname && sessionNickname === authorNickname);

    if (!canUpdate) {
      response.status(403).json({ success: false, error: '작성자만 게시물을 수정할 수 있습니다.' });
      return;
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update({ content })
      .eq('id', postId);

    if (updateError) {
      throw updateError;
    }

    response.status(200).json({ success: true });
  } catch (error) {
    console.error('Post update error:', error);
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '게시물 수정에 실패했습니다.',
    });
  }
}
