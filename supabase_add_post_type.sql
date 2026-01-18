-- Add post_type column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'normal';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);

-- Update existing posts to have 'normal' type if null
UPDATE posts SET post_type = 'normal' WHERE post_type IS NULL;
