-- Carshenas data-model lab (research pass F for CS-4). PostgreSQL 17.11 + pgvector 0.8.6.
-- Scratch database only; nothing here is a migration of the repository.
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE (listing_id WITH =, valid WITH &&) on vehicle_membership
CREATE EXTENSION IF NOT EXISTS vector;      -- photo embeddings (ADR-0007)
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy alias lookups (provisional)
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- LAB ONLY: hmac() and gen_random_bytes() to fake phone HMACs and tokens.
                                            -- In production the worker computes HMACs; the key never enters SQL.
