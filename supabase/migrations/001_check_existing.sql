-- Check what tables already exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'collaboration_rooms', 
  'room_participants', 
  'room_messages', 
  'room_invoices',
  'tents',
  'tent_members',
  'tent_messages',
  'tent_invoices'
);

-- Check what indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%room%' OR indexname LIKE '%tent%';

-- If you want to start fresh (BE CAREFUL - this will delete data):
-- DROP TABLE IF EXISTS room_invoices CASCADE;
-- DROP TABLE IF EXISTS room_messages CASCADE;
-- DROP TABLE IF EXISTS room_participants CASCADE;
-- DROP TABLE IF EXISTS collaboration_rooms CASCADE;
-- DROP TABLE IF EXISTS tent_invoices CASCADE;
-- DROP TABLE IF EXISTS tent_messages CASCADE;
-- DROP TABLE IF EXISTS tent_members CASCADE;
-- DROP TABLE IF EXISTS tents CASCADE;