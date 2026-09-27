-- Read-only role the agent connects with.
-- Usage: psql -d reviews -v ro_password="$VERBATIM_RO_PASSWORD" -f db/roles.sql

SELECT 'CREATE ROLE verbatim_ro' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'verbatim_ro')
\gexec

ALTER ROLE verbatim_ro WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
    CONNECTION LIMIT 10 PASSWORD :'ro_password';

-- Session guards (defense in depth; the real guard is SELECT-only grants)
ALTER ROLE verbatim_ro SET default_transaction_read_only = on;
ALTER ROLE verbatim_ro SET statement_timeout = '15s';
ALTER ROLE verbatim_ro SET lock_timeout = '2s';
ALTER ROLE verbatim_ro SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE verbatim_ro SET work_mem = '32MB';

-- Database: connect only, no temp tables
REVOKE ALL ON DATABASE reviews FROM PUBLIC;
GRANT CONNECT ON DATABASE reviews TO verbatim_ro;

-- Schema: read, never create
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO verbatim_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO verbatim_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO verbatim_ro;
