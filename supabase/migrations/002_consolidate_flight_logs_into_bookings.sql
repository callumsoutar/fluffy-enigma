-- Migration: Consolidate flight_logs into bookings table
-- This migration adds all flight log fields to bookings and migrates existing data
-- NOTE: flight_logs table will remain in database but will be ignored in application code

-- Step 1: Add all flight log columns to bookings table

-- Checkout fields (REQUIRED per requirements)
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS checked_out_aircraft_id UUID REFERENCES aircraft(id),
  ADD COLUMN IF NOT EXISTS checked_out_instructor_id UUID REFERENCES instructors(id);

-- Actual flight times
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta TIMESTAMPTZ;

-- Meter readings
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS hobbs_start NUMERIC,
  ADD COLUMN IF NOT EXISTS hobbs_end NUMERIC,
  ADD COLUMN IF NOT EXISTS tach_start NUMERIC,
  ADD COLUMN IF NOT EXISTS tach_end NUMERIC;

-- Calculated flight times
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS flight_time_hobbs NUMERIC,
  ADD COLUMN IF NOT EXISTS flight_time_tach NUMERIC,
  ADD COLUMN IF NOT EXISTS flight_time NUMERIC;

-- Flight details
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS fuel_on_board INTEGER,
  ADD COLUMN IF NOT EXISTS passengers TEXT,
  ADD COLUMN IF NOT EXISTS route TEXT,
  ADD COLUMN IF NOT EXISTS equipment JSONB;

-- Completion flags
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS briefing_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS authorization_completed BOOLEAN DEFAULT false;

-- Flight-specific remarks
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS flight_remarks TEXT;

-- Time tracking
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS solo_end_hobbs NUMERIC,
  ADD COLUMN IF NOT EXISTS dual_time NUMERIC,
  ADD COLUMN IF NOT EXISTS solo_time NUMERIC,
  ADD COLUMN IF NOT EXISTS total_hours_start NUMERIC,
  ADD COLUMN IF NOT EXISTS total_hours_end NUMERIC;

-- Description (from flight_logs, doesn't exist in bookings)
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Step 2: Migrate flight_logs data to bookings
-- Prefer flight_logs values when both exist (more recent/accurate)
UPDATE bookings b
SET 
  -- Checkout fields
  checked_out_aircraft_id = fl.checked_out_aircraft_id,
  checked_out_instructor_id = fl.checked_out_instructor_id,
  
  -- Actual times (prefer flight_logs, fallback to booking times)
  actual_start = COALESCE(fl.actual_start, b.start_time),
  actual_end = COALESCE(fl.actual_end, b.end_time),
  eta = fl.eta,
  
  -- Meter readings
  hobbs_start = fl.hobbs_start,
  hobbs_end = fl.hobbs_end,
  tach_start = fl.tach_start,
  tach_end = fl.tach_end,
  
  -- Calculated times
  flight_time_hobbs = fl.flight_time_hobbs,
  flight_time_tach = fl.flight_time_tach,
  flight_time = fl.flight_time,
  
  -- Flight details
  fuel_on_board = fl.fuel_on_board,
  passengers = fl.passengers,
  route = fl.route,
  equipment = fl.equipment,
  
  -- Completion flags
  briefing_completed = COALESCE(fl.briefing_completed, false),
  authorization_completed = COALESCE(fl.authorization_completed, false),
  
  -- Remarks (merge: prefer flight_logs.remarks if exists, else keep bookings.remarks)
  flight_remarks = fl.flight_remarks,
  remarks = COALESCE(fl.remarks, b.remarks),
  
  -- Time tracking
  solo_end_hobbs = fl.solo_end_hobbs,
  dual_time = fl.dual_time,
  solo_time = fl.solo_time,
  total_hours_start = fl.total_hours_start,
  total_hours_end = fl.total_hours_end,
  
  -- Description (from flight_logs)
  description = fl.description,
  
  -- Duplicates: prefer flight_logs values if they exist (more recent/accurate)
  flight_type_id = COALESCE(fl.flight_type_id, b.flight_type_id),
  lesson_id = COALESCE(fl.lesson_id, b.lesson_id)
  
FROM flight_logs fl
WHERE fl.booking_id = b.id;

-- Step 3: Add indexes for commonly queried flight log fields
CREATE INDEX IF NOT EXISTS idx_bookings_checked_out_aircraft_id ON bookings(checked_out_aircraft_id);
CREATE INDEX IF NOT EXISTS idx_bookings_checked_out_instructor_id ON bookings(checked_out_instructor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_actual_start ON bookings(actual_start);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type_status ON bookings(booking_type, status);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN bookings.checked_out_aircraft_id IS 'Aircraft actually used for flight (may differ from scheduled aircraft_id)';
COMMENT ON COLUMN bookings.checked_out_instructor_id IS 'Instructor actually assigned at checkout (may differ from scheduled instructor_id)';
COMMENT ON COLUMN bookings.actual_start IS 'Actual flight start time (may differ from scheduled start_time)';
COMMENT ON COLUMN bookings.actual_end IS 'Actual flight end time (may differ from scheduled end_time)';
COMMENT ON COLUMN bookings.flight_remarks IS 'Flight-specific remarks (separate from general booking remarks)';
COMMENT ON COLUMN bookings.description IS 'Flight description/notes (migrated from flight_logs)';
