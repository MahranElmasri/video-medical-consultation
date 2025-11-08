CREATE TABLE consultation_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'waiting',
    creator_id TEXT
);