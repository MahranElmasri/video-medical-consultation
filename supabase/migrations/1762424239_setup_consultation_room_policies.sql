-- Migration: setup_consultation_room_policies
-- Created at: 1762424239

-- Enable RLS
ALTER TABLE consultation_rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert rooms (for no-login access)
CREATE POLICY "Allow public room creation"
ON consultation_rooms
FOR INSERT
WITH CHECK (true);

-- Allow anyone to read rooms they have room_id for
CREATE POLICY "Allow room access with room_id"
ON consultation_rooms
FOR SELECT
USING (true);

-- Allow status updates
CREATE POLICY "Allow room status updates"
ON consultation_rooms
FOR UPDATE
USING (true);

-- Create index for faster room lookups
CREATE INDEX idx_consultation_rooms_room_id ON consultation_rooms(room_id);
CREATE INDEX idx_consultation_rooms_expires_at ON consultation_rooms(expires_at);

-- Add cleanup function for expired rooms
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM consultation_rooms
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;;