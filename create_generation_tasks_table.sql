-- Create the generation_tasks table for storing polling task status
CREATE TABLE IF NOT EXISTS generation_tasks (
  task_id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating',
  progress INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create an index on task_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_generation_tasks_task_id ON generation_tasks(task_id);

-- Create an index on created_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at ON generation_tasks(created_at);

-- Add a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_generation_tasks_updated_at ON generation_tasks;
CREATE TRIGGER update_generation_tasks_updated_at
    BEFORE UPDATE ON generation_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set up RLS (Row Level Security) policy
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (used by Edge Functions)
CREATE POLICY "Allow service role full access" ON generation_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional: Allow anon users to read their own tasks (if you want client-side polling)
-- CREATE POLICY "Allow anon read own tasks" ON generation_tasks
--   FOR SELECT
--   TO anon
--   USING (true); 