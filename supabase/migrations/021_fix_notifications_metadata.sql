-- Add metadata column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Ensure all required columns exist
DO $$ 
BEGIN
  -- Check if notifications table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'notifications'
  ) THEN
    -- Add any missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
      ALTER TABLE notifications ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title') THEN
      ALTER TABLE notifications ADD COLUMN title TEXT NOT NULL DEFAULT 'Notification';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'message') THEN
      ALTER TABLE notifications ADD COLUMN message TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
      ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT FALSE;
    END IF;
  END IF;
END $$;