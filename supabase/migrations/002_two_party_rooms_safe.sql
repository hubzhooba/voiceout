-- Two-Party Collaboration Rooms Schema (Safe Version - Checks for existing objects)

-- Create collaboration_rooms table if it doesn't exist
CREATE TABLE IF NOT EXISTS collaboration_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  invite_link TEXT,
  is_locked BOOLEAN DEFAULT false,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create room_participants table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('creator', 'participant')) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create room_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create room_invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS room_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES profiles(id),
  shared_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, invoice_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_collaboration_rooms_invite_code ON collaboration_rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_collaboration_rooms_workspace ON collaboration_rooms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_invoices_room ON room_invoices(room_id);

-- Enable RLS if not already enabled
ALTER TABLE collaboration_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view rooms they participate in" ON collaboration_rooms;
CREATE POLICY "Users can view rooms they participate in"
  ON collaboration_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = collaboration_rooms.id
      AND room_participants.user_id = auth.uid()
    )
    OR NOT is_locked -- Allow viewing unlocked rooms to join
  );

DROP POLICY IF EXISTS "Users can create rooms" ON collaboration_rooms;
CREATE POLICY "Users can create rooms"
  ON collaboration_rooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Room creators can update their rooms" ON collaboration_rooms;
CREATE POLICY "Room creators can update their rooms"
  ON collaboration_rooms FOR UPDATE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Room creators can delete their rooms" ON collaboration_rooms;
CREATE POLICY "Room creators can delete their rooms"
  ON collaboration_rooms FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for room_participants
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON room_participants;
CREATE POLICY "Users can view participants in their rooms"
  ON room_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_participants.room_id
      AND rp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can add participants" ON room_participants;
CREATE POLICY "System can add participants"
  ON room_participants FOR INSERT
  WITH CHECK (
    -- Either the user is adding themselves or they're the room creator
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM collaboration_rooms
      WHERE collaboration_rooms.id = room_id
      AND collaboration_rooms.created_by = auth.uid()
    )
  );

-- RLS Policies for room_messages
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON room_messages;
CREATE POLICY "Users can view messages in their rooms"
  ON room_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_messages.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their rooms" ON room_messages;
CREATE POLICY "Users can send messages to their rooms"
  ON room_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_messages.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

-- RLS Policies for room_invoices
DROP POLICY IF EXISTS "Users can view invoices in their rooms" ON room_invoices;
CREATE POLICY "Users can view invoices in their rooms"
  ON room_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_invoices.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can share invoices to their rooms" ON room_invoices;
CREATE POLICY "Users can share invoices to their rooms"
  ON room_invoices FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_invoices.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

-- Function to generate unique invite codes (create or replace)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if room is full (create or replace)
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM room_participants WHERE room_id = NEW.room_id) >= 2 THEN
    RAISE EXCEPTION 'Room is full (maximum 2 participants)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_room_capacity ON room_participants;
CREATE TRIGGER enforce_room_capacity
  BEFORE INSERT ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION check_room_capacity();

-- Function to auto-lock room when second participant joins (create or replace)
CREATE OR REPLACE FUNCTION auto_lock_room()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM room_participants WHERE room_id = NEW.room_id) = 2 THEN
    UPDATE collaboration_rooms
    SET is_locked = true
    WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS auto_lock_room_trigger ON room_participants;
CREATE TRIGGER auto_lock_room_trigger
  AFTER INSERT ON room_participants
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_room();