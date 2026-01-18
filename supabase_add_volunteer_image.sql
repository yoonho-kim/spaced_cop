-- Add image_url column to volunteer_activities table
ALTER TABLE volunteer_activities ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN volunteer_activities.image_url IS 'URL of the AI-generated or fetched image for the volunteer activity';
