-- COMPLETE DATABASE RESET TO TENT-BASED SYSTEM
-- WARNING: This will DELETE ALL DATA and start fresh with the tent system

-- Step 1: Drop all existing tables and their dependencies
DROP TABLE IF EXISTS invoice_activity CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS tent_invoices CASCADE;
DROP TABLE IF EXISTS tent_messages CASCADE;
DROP TABLE IF EXISTS tent_notifications CASCADE;
DROP TABLE IF EXISTS tent_members CASCADE;
DROP TABLE IF EXISTS tents CASCADE;
DROP TABLE IF EXISTS collaboration_rooms CASCADE;
DROP TABLE IF EXISTS room_participants CASCADE;
DROP TABLE IF EXISTS room_messages CASCADE;
DROP TABLE IF EXISTS room_invoices CASCADE;
DROP TABLE IF EXISTS room_notifications CASCADE;
DROP TABLE IF EXISTS workspace_invitations CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Drop all old functions and triggers
DROP FUNCTION IF EXISTS check_room_capacity() CASCADE;
DROP FUNCTION IF EXISTS auto_lock_room() CASCADE;
DROP FUNCTION IF EXISTS check_tent_capacity() CASCADE;
DROP FUNCTION IF EXISTS auto_lock_tent() CASCADE;
DROP FUNCTION IF EXISTS set_tent_creator_admin() CASCADE;
DROP FUNCTION IF EXISTS generate_invite_code() CASCADE;

-- Step 2: Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create the tent system tables
CREATE TABLE tents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  invite_link TEXT,
  is_locked BOOLEAN DEFAULT false,
  business_address TEXT,
  business_tin TEXT,
  default_withholding_tax DECIMAL(5,2) DEFAULT 0,
  invoice_prefix TEXT,
  invoice_notes TEXT,
  settings JSONB DEFAULT '{}',
  tent_type TEXT DEFAULT 'invoice_management',
  creator_role TEXT CHECK (creator_role IN ('client', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tent_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tent_role TEXT CHECK (tent_role IN ('client', 'manager')) NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tent_id, user_id)
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_tin TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  is_cash_sale BOOLEAN DEFAULT true,
  service_description TEXT,
  service_date DATE,
  amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  withholding_tax DECIMAL(10,2) DEFAULT 0,
  withholding_tax_percent DECIMAL(5,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')) DEFAULT 'draft',
  notes TEXT,
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tent_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES profiles(id),
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tent_id, invoice_id)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX idx_tents_invite_code ON tents(invite_code);
CREATE INDEX idx_tents_created_by ON tents(created_by);
CREATE INDEX idx_tent_members_tent ON tent_members(tent_id);
CREATE INDEX idx_tent_members_user ON tent_members(user_id);
CREATE INDEX idx_invoices_tent ON invoices(tent_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_tent_messages_tent ON tent_messages(tent_id);
CREATE INDEX idx_tent_invoices_tent ON tent_invoices(tent_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Step 5: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Step 7: Create RLS policies for tents
CREATE POLICY "Users can view tents they participate in"
  ON tents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
    )
    OR NOT is_locked
  );

CREATE POLICY "Users can create tents"
  ON tents FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Tent admins can update their tents"
  ON tents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

CREATE POLICY "Tent admins can delete their tents"
  ON tents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

-- Step 8: Create RLS policies for tent_members
CREATE POLICY "Users can view members in their tents"
  ON tent_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "System can add tent members"
  ON tent_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- Step 9: Create RLS policies for invoices
CREATE POLICY "Users can view invoices in their tents"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Clients can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.tent_role = 'client'
    )
  );

CREATE POLICY "Users can update invoices based on role"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND (
        (invoices.submitted_by = auth.uid() AND invoices.status = 'draft')
        OR tent_members.tent_role = 'manager'
        OR tent_members.is_admin = true
      )
    )
  );

CREATE POLICY "Clients can delete their draft invoices"
  ON invoices FOR DELETE
  USING (
    invoices.status IN ('draft', 'rejected')
    AND invoices.submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Step 10: Create RLS policies for invoice_items
CREATE POLICY "Users can view invoice items"
  ON invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN tent_members ON tent_members.tent_id = invoices.tent_id
      WHERE invoices.id = invoice_items.invoice_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN tent_members ON tent_members.tent_id = invoices.tent_id
      WHERE invoices.id = invoice_items.invoice_id
      AND tent_members.user_id = auth.uid()
      AND (
        invoices.submitted_by = auth.uid()
        OR tent_members.tent_role = 'manager'
        OR tent_members.is_admin = true
      )
    )
  );

-- Step 11: Create RLS policies for tent_messages
CREATE POLICY "Users can view messages in their tents"
  ON tent_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their tents"
  ON tent_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Step 12: Create RLS policies for notifications
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Step 13: Create helper functions
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

CREATE OR REPLACE FUNCTION check_tent_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tent_members WHERE tent_id = NEW.tent_id) >= 2 THEN
    RAISE EXCEPTION 'Tent is full (maximum 2 members)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_lock_tent()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tent_members WHERE tent_id = NEW.tent_id) = 2 THEN
    UPDATE tents SET is_locked = true WHERE id = NEW.tent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_tent_creator_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tent_members 
    WHERE tent_id = NEW.tent_id 
    AND user_id != NEW.user_id
  ) THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Create triggers
CREATE TRIGGER enforce_tent_capacity
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION check_tent_capacity();

CREATE TRIGGER auto_lock_tent_trigger
  AFTER INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_tent();

CREATE TRIGGER set_creator_as_admin
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION set_tent_creator_admin();

-- Step 15: Create a trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Success!
DO $$
BEGIN
  RAISE NOTICE '✅ Database reset complete!';
  RAISE NOTICE '✅ CreatorTent system is ready';
  RAISE NOTICE '✅ All tables, policies, and triggers created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test user signup/login';
  RAISE NOTICE '2. Create your first tent';
  RAISE NOTICE '3. Invite a partner to collaborate';
END $$;