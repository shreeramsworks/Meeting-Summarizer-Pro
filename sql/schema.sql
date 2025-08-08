
-- Create summaries table
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  transcript TEXT NOT NULL,
  summary TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security for summaries
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own summaries
CREATE POLICY "Users can manage their own summaries"
ON summaries
FOR ALL
USING (auth.uid() = user_id);


-- Create reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  summary_id UUID REFERENCES summaries(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL
);

-- Enable Row Level Security for reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own reminders
CREATE POLICY "Users can manage their own reminders"
ON reminders
FOR ALL
USING (auth.uid() = user_id);

-- Create a 'full_name' column in the auth.users table metadata
-- This is just an example, if you have other user data you'd like to store, you can add it here.
-- Note: This is illustrative. The user's full_name is typically stored in the 'raw_user_meta_data' JSONB column.
-- The signup logic already handles adding the full name. This comment is for informational purposes.
