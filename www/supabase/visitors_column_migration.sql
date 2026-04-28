-- Add missing columns to visitors table if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='interested_course') THEN
        ALTER TABLE visitors ADD COLUMN interested_course TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='follow_up_date') THEN
        ALTER TABLE visitors ADD COLUMN follow_up_date DATE;
    END IF;
END $$;
