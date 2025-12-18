-- Drop description and authorization_override columns from bookings table

-- Drop description column (migrated from flight_logs, but user wants it removed)
ALTER TABLE bookings DROP COLUMN IF EXISTS description;

-- Drop authorization_override related columns
ALTER TABLE bookings DROP COLUMN IF EXISTS authorization_override;
ALTER TABLE bookings DROP COLUMN IF EXISTS authorization_override_by;
ALTER TABLE bookings DROP COLUMN IF EXISTS authorization_override_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS authorization_override_reason;
