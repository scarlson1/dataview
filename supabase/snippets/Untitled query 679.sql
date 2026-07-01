-- CREATE TYPE clientStatus AS ENUM ('active', 'inactive', 'prospect');

ALTER TABLE clients 
  ALTER COLUMN status TYPE clientstatus
  USING status::clientstatus;

ALTER TABLE clients ALTER COLUMN status SET DEFAULT 'active'::clientstatus;
