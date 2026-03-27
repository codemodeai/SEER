-- SEER v1.0.2 Schema Migration
-- Adds: support_tickets, ticket_replies, cancellation_feedback tables with RLS

-- 1. Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  email text,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can read their own tickets
CREATE POLICY support_tickets_select ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own tickets
CREATE POLICY support_tickets_insert ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role handles admin access and status updates


-- 2. Ticket replies table
CREATE TABLE IF NOT EXISTS ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  message text NOT NULL,
  is_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies(ticket_id);

ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;

-- Users can read replies on their own tickets
CREATE POLICY ticket_replies_select ON ticket_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_replies.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- Users can insert replies on their own tickets
CREATE POLICY ticket_replies_insert ON ticket_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_staff = false);


-- 3. Cancellation feedback table
CREATE TABLE IF NOT EXISTS cancellation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  email text,
  previous_plan text NOT NULL,
  reason text NOT NULL,
  feedback text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_user ON cancellation_feedback(user_id);

ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback (no read access needed)
CREATE POLICY cancellation_feedback_insert ON cancellation_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
