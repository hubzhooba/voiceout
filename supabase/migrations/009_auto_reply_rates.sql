-- Create table for storing user rates and auto-reply settings
CREATE TABLE IF NOT EXISTS public.user_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tent_id UUID REFERENCES public.tents(id) ON DELETE CASCADE,
  
  -- Service-specific rates as array of objects
  service_rates JSONB DEFAULT '[]',
  -- Example: [
  --   {"service": "TikTok Video crossposted to IG Reels", "rate": 300000, "currency": "PHP", "notes": "net of taxes, no Facebook"},
  --   {"service": "TikTok Video", "rate": 170000, "currency": "PHP", "notes": "net of taxes"},
  --   {"service": "IG Reel", "rate": 150000, "currency": "PHP", "notes": "net of taxes"}
  -- ]
  
  -- Currency setting
  default_currency TEXT DEFAULT 'PHP',
  
  -- Auto-reply settings
  auto_reply_enabled BOOLEAN DEFAULT false,
  auto_reply_delay_minutes INTEGER DEFAULT 5, -- Delay before auto-replying
  
  -- Reply templates with rate placeholders
  reply_template TEXT DEFAULT 'Thank you for reaching out! I''m interested in discussing this opportunity.

Here are my current rates:

{{service_rates}}

Please let me know which services you''re interested in, along with campaign details, timeline, and deliverables. I''d be happy to provide a customized package based on your specific needs.

Looking forward to potentially working together!',
  
  -- Custom signature
  email_signature TEXT DEFAULT 'Best regards',
  
  -- Minimum thresholds for auto-reply
  min_seriousness_score INTEGER DEFAULT 5, -- Only auto-reply to serious inquiries
  
  -- Additional notes to include in replies
  additional_notes TEXT,
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for tracking auto-replies
CREATE TABLE IF NOT EXISTS public.auto_reply_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id UUID NOT NULL REFERENCES public.email_inquiries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tent_id UUID REFERENCES public.tents(id) ON DELETE CASCADE,
  
  -- Reply details
  reply_sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reply_subject TEXT NOT NULL,
  reply_body TEXT NOT NULL,
  reply_status TEXT CHECK (reply_status IN ('sent', 'failed', 'queued')) DEFAULT 'queued',
  
  -- Email service response
  email_service_response JSONB,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies for user_rates
ALTER TABLE public.user_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rates" ON public.user_rates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rates" ON public.user_rates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rates" ON public.user_rates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rates" ON public.user_rates
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for auto_reply_log
ALTER TABLE public.auto_reply_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reply logs" ON public.auto_reply_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reply logs" ON public.auto_reply_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_user_rates_user_id ON public.user_rates(user_id);
CREATE INDEX idx_user_rates_tent_id ON public.user_rates(tent_id);
CREATE INDEX idx_auto_reply_log_inquiry_id ON public.auto_reply_log(inquiry_id);
CREATE INDEX idx_auto_reply_log_user_id ON public.auto_reply_log(user_id);

-- Add auto_reply_sent field to email_inquiries if not exists
ALTER TABLE public.email_inquiries 
ADD COLUMN IF NOT EXISTS auto_reply_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_reply_sent_at TIMESTAMP WITH TIME ZONE;