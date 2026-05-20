-- Feed image MVP schema for Supabase.
-- Fresh projects can run the CREATE TABLE statement directly.
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content text,
  image_url text NOT NULL,
  image_path text,
  image_width int,
  image_height int,
  created_at timestamptz DEFAULT now()
);

-- Existing projects can safely add the MVP columns.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_width int;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_height int;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Compatibility with the current app's existing feed UI.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_nickname text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_all" ON posts;
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
DROP POLICY IF EXISTS "posts_update_own" ON posts;
DROP POLICY IF EXISTS "posts_delete_own" ON posts;
DROP POLICY IF EXISTS "posts_read_all" ON posts;
DROP POLICY IF EXISTS "posts_write_authenticated" ON posts;
DROP POLICY IF EXISTS "posts_update_authenticated" ON posts;
DROP POLICY IF EXISTS "posts_delete_authenticated" ON posts;

CREATE POLICY "posts_select_all" ON posts
  FOR SELECT
  USING (true);

CREATE POLICY "posts_insert_own" ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND image_url IS NOT NULL);

CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- After backfilling existing rows, enforce the requested MVP constraints:
-- ALTER TABLE posts ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE posts ALTER COLUMN image_url SET NOT NULL;
