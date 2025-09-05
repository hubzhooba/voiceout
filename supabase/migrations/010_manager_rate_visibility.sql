-- Allow managers to view rates of users in their tents
CREATE POLICY "Managers can view tent member rates" ON public.user_rates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tent_members tm1
      WHERE tm1.tent_id = user_rates.tent_id
      AND tm1.user_id = auth.uid()
      AND tm1.role = 'manager'
    )
  );

-- Allow managers to view auto-reply logs in their tents  
CREATE POLICY "Managers can view tent reply logs" ON public.auto_reply_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tent_members tm
      WHERE tm.tent_id = auto_reply_log.tent_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'manager'
    )
  );