-- CLEANUP SCRIPT: Remove existing tables and recreate
-- WARNING: This will DELETE ALL DATA in these tables!
-- Only run this if you want to completely reset these features

-- Step 1: Drop all triggers first
DROP TRIGGER IF EXISTS invoice_revision_trigger ON invoices;
DROP TRIGGER IF EXISTS invoice_sla_trigger ON invoices;
DROP TRIGGER IF EXISTS audit_invoices ON invoices;
DROP TRIGGER IF EXISTS audit_tent_members ON tent_members;

-- Step 2: Drop all functions
DROP FUNCTION IF EXISTS track_invoice_revision() CASCADE;
DROP FUNCTION IF EXISTS track_invoice_sla() CASCADE;
DROP FUNCTION IF EXISTS log_audit_trail() CASCADE;

-- Step 3: Drop all tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS sla_tracking CASCADE;
DROP TABLE IF EXISTS invoice_signatures CASCADE;
DROP TABLE IF EXISTS audit_trail CASCADE;
DROP TABLE IF EXISTS invoice_revisions CASCADE;
DROP TABLE IF EXISTS invoice_attachments CASCADE;
DROP TABLE IF EXISTS invoice_comments CASCADE;
DROP TABLE IF EXISTS tent_messages CASCADE;

-- Step 4: Remove added columns from existing tables
ALTER TABLE invoices 
  DROP COLUMN IF EXISTS has_attachments,
  DROP COLUMN IF EXISTS requires_signature,
  DROP COLUMN IF EXISTS is_signed,
  DROP COLUMN IF EXISTS revision_count,
  DROP COLUMN IF EXISTS last_activity_at,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS due_date;

ALTER TABLE tents 
  DROP COLUMN IF EXISTS enable_messaging,
  DROP COLUMN IF EXISTS enable_attachments,
  DROP COLUMN IF EXISTS max_attachment_size,
  DROP COLUMN IF EXISTS sla_hours,
  DROP COLUMN IF EXISTS require_signatures;

-- Now you can run the safe migration script (002_add_communication_and_documents_safe.sql) to recreate everything