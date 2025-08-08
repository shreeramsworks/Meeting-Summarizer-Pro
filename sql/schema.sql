-- Drop existing tables and policies if they exist, for a clean setup.
DROP POLICY IF EXISTS "Allow users to manage their own reminders" ON reminders;
DROP POLICY IF EXISTS "Allow users to manage their own summaries" ON summaries;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS summaries;

-- Create summaries table
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    transcript TEXT NOT NULL,
    summary TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create reminders table
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    "remindAt" TIMESTAMPTZ NOT NULL,
    "summaryId" UUID REFERENCES summaries(id) ON DELETE CASCADE
);

-- Enable Row Level Security (RLS) for both tables
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for the summaries table
CREATE POLICY "Allow individual read access on summaries"
ON summaries
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert access on summaries"
ON summaries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update access on summaries"
ON summaries
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete access on summaries"
ON summaries
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create policies for the reminders table
CREATE POLICY "Allow individual read access on reminders"
ON reminders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert access on reminders"
ON reminders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update access on reminders"
ON reminders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete access on reminders"
ON reminders
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

    