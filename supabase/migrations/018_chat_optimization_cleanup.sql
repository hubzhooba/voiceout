-- Optimization for tent chat messages
-- Adds auto-cleanup for old messages and performance improvements

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tent_chat_messages_tent_created 
  ON tent_chat_messages(tent_id, created_at DESC);

-- Create a function to clean up old messages (keep last 30 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages(
  days_to_keep INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete messages older than specified days
  -- But always keep messages with mentions or project links
  WITH deleted AS (
    DELETE FROM tent_chat_messages
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep
    AND (mentioned_users IS NULL OR array_length(mentioned_users, 1) = 0)
    AND (linked_projects IS NULL OR array_length(linked_projects, 1) = 0)
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up old messages daily
-- Note: This requires pg_cron extension which may need to be enabled
-- If pg_cron is not available, you can run this function manually or via a cron job

-- Optional: Enable pg_cron if available (requires superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Optional: Schedule daily cleanup at 3 AM (if pg_cron is enabled)
-- SELECT cron.schedule(
--   'cleanup-old-chat-messages',
--   '0 3 * * *',
--   'SELECT cleanup_old_chat_messages(30);'
-- );

-- Create a materialized view for chat statistics (optional, for analytics)
CREATE MATERIALIZED VIEW IF NOT EXISTS tent_chat_stats AS
SELECT 
  tent_id,
  COUNT(*) as total_messages,
  COUNT(DISTINCT user_id) as unique_users,
  DATE(created_at) as message_date,
  COUNT(CASE WHEN array_length(mentioned_users, 1) > 0 THEN 1 END) as messages_with_mentions,
  COUNT(CASE WHEN array_length(linked_projects, 1) > 0 THEN 1 END) as messages_with_projects
FROM tent_chat_messages
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY tent_id, DATE(created_at);

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_tent_chat_stats_tent_date 
  ON tent_chat_stats(tent_id, message_date DESC);

-- Function to refresh the stats (can be called periodically)
CREATE OR REPLACE FUNCTION refresh_chat_stats() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tent_chat_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a policy for service role to perform cleanup
CREATE POLICY "Service role can delete old messages"
  ON tent_chat_messages
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Optimize the table with better settings
ALTER TABLE tent_chat_messages SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Add comment
COMMENT ON FUNCTION cleanup_old_chat_messages IS 'Removes chat messages older than specified days, preserving messages with mentions or project links';
COMMENT ON MATERIALIZED VIEW tent_chat_stats IS 'Aggregated statistics for chat messages, refreshed periodically';

-- Manual cleanup instructions
COMMENT ON TABLE tent_chat_messages IS E'Real-time chat messages within tents.

Performance optimizations:
1. Messages are cached in browser localStorage
2. Old messages auto-deleted after 30 days (except important ones)
3. Run cleanup manually: SELECT cleanup_old_chat_messages(30);
4. Refresh stats: SELECT refresh_chat_stats();

To enable automatic cleanup (requires pg_cron):
1. Enable pg_cron extension
2. Schedule the cleanup function to run daily';