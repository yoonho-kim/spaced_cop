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

const getManageablePost = async (supabase, postId, session) => {
  const { data: post, error } = await supabase
    .from('posts')
    .select('id, author_nickname')
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!post) {
    return { post: null, error: '게시물을 찾을 수 없습니다.', status: 404 };
  }

  const sessionNickname = String(session.nickname || '').trim();
  const authorNickname = String(post.author_nickname || '').trim();
  const canManage = session.isAdmin === true || (sessionNickname && authorNickname && sessionNickname === authorNickname);

  if (!canManage) {
    return { post, error: '작성자만 게시물을 변경할 수 있습니다.', status: 403 };
  }

  return { post, error: null, status: 200 };
};

const updatePost = async (supabase, postId, content) => {
  const { error } = await supabase
    .from('posts')
    .update({ content })
    .eq('id', postId);

  if (error) {
    throw new Error(`게시물 수정 실패: ${error.message}`);
  }
};

const deletePost = async (supabase, postId) => {
  const { error: commentsError } = await supabase
    .from('post_comments')
    .delete()
    .eq('post_id', postId);
  if (commentsError) {
    throw new Error(`댓글 정리 실패: ${commentsError.message}`);
  }

  const { error: likesError } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId);
  if (likesError) {
    throw new Error(`좋아요 정리 실패: ${likesError.message}`);
  }

  const { data: deletedPost, error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .select('id')
    .maybeSingle();

  if (deleteError) {
    throw new Error(`게시물 삭제 실패: ${deleteError.message}`);
  }

  if (!deletedPost) {
    throw new Error('삭제할 게시물을 찾지 못했습니다.');
  }
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

  if (!enforceRateLimit(request, response, { key: `posts:${session.uid}`, max: 40, windowMs: 60_000 })) {
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
    const action = String(body?.action || '').trim();
    const postId = String(body?.postId || '').trim();
    const content = String(body?.content || '').trim();

    if (!postId) {
      response.status(400).json({ success: false, error: '게시물 ID가 없습니다.' });
      return;
    }

    if (action !== 'update' && action !== 'delete') {
      response.status(400).json({ success: false, error: '지원하지 않는 게시물 작업입니다.' });
      return;
    }

    if (action === 'update' && !content) {
      response.status(400).json({ success: false, error: '내용이 비어 있습니다.' });
      return;
    }

    const manageable = await getManageablePost(supabase, postId, session);
    if (manageable.error) {
      response.status(manageable.status).json({ success: false, error: manageable.error });
      return;
    }

    if (action === 'update') {
      await updatePost(supabase, postId, content);
    } else {
      await deletePost(supabase, postId);
    }

    response.status(200).json({ success: true });
  } catch (error) {
    console.error('Post API error:', error);
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '게시물 작업에 실패했습니다.',
    });
  }
}
