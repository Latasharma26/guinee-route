CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  badge_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location TEXT,
  duty_duration TEXT,
  last_sync TEXT,
  active_mission_code TEXT
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  owner TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  mission_code TEXT NOT NULL UNIQUE,
  road_name TEXT NOT NULL,
  route TEXT,
  total_km NUMERIC(8, 2) NOT NULL,
  covered_km NUMERIC(8, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  agent_id INTEGER REFERENCES agents(id),
  violations INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  duration_text TEXT
);

CREATE TABLE IF NOT EXISTS violations (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  mission_id INTEGER REFERENCES missions(id) ON DELETE SET NULL,
  violation_code TEXT,
  violation_type TEXT NOT NULL,
  severity TEXT,
  fine_amount_gnf NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Unpaid',
  payment_status TEXT DEFAULT 'Unpaid',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);