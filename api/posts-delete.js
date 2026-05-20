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

  if (!enforceRateLimit(request, response, { key: `posts-delete:${session.uid}`, max: 20, windowMs: 60_000 })) {
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

    if (!postId) {
      response.status(400).json({ success: false, error: '게시물 ID가 없습니다.' });
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
    const canDelete = session.isAdmin === true || (sessionNickname && authorNickname && sessionNickname === authorNickname);

    if (!canDelete) {
      response.status(403).json({ success: false, error: '작성자만 게시물을 삭제할 수 있습니다.' });
      return;
    }

    const { error: commentsError } = await supabase
      .from('post_comments')
      .delete()
      .eq('post_id', postId);
    if (commentsError) throw commentsError;

    const { error: likesError } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId);
    if (likesError) throw likesError;

    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      throw deleteError;
    }

    response.status(200).json({ success: true });
  } catch (error) {
    console.error('Post delete error:', error);
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '게시물 삭제에 실패했습니다.',
    });
  }
}
