-- Migration 023: Backfill agency_projects.cloud_memory into project_memory_files
-- Splits the flat markdown blob on top-level ## headings into the 6 aspect types.
-- Unmapped sections are concatenated into project_overview.
-- Safe to run multiple times: INSERT ... ON CONFLICT DO NOTHING guards against duplicates.

CREATE OR REPLACE FUNCTION _map_heading_to_aspect(heading text) RETURNS aspect_type AS $$
DECLARE
  h text := lower(heading);
BEGIN
  IF h ~ '(overview|summary|description|project)' THEN
    RETURN 'project_overview';
  ELSIF h ~ '(architecture|stack|tech|structure|folder|design)' THEN
    RETURN 'architecture';
  ELSIF h ~ '(feature|task|todo|backlog|roadmap|milestone|open)' THEN
    RETURN 'features';
  ELSIF h ~ '(decision|choice|rationale|adr)' THEN
    RETURN 'decisions';
  ELSIF h ~ '(error|fix|bug|issue|incident|postmortem)' THEN
    RETURN 'errors_fixes';
  ELSIF h ~ '(session|log|history|activity|journal|changelog)' THEN
    RETURN 'session_log';
  ELSE
    RETURN 'project_overview';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _backfill_project_memory() RETURNS integer AS $$
DECLARE
  proj RECORD;
  section_match RECORD;
  buckets jsonb;
  bucket_text text;
  aspect aspect_type;
  agency_owner uuid;
  inserted_rows integer := 0;
  content_parts text[];
  current_heading text;
  current_body text;
  i integer;
BEGIN
  FOR proj IN
    SELECT id, agency_id, project_name, cloud_memory, updated_by
    FROM agency_projects
    WHERE cloud_memory IS NOT NULL
      AND length(cloud_memory) > 0
  LOOP
    SELECT owner_id INTO agency_owner FROM agencies WHERE id = proj.agency_id;
    IF agency_owner IS NULL THEN
      CONTINUE;
    END IF;

    buckets := jsonb_build_object(
      'project_overview', '',
      'architecture', '',
      'features', '',
      'decisions', '',
      'errors_fixes', '',
      'session_log', ''
    );

    -- Split on lines that start with '## ' — take heading + body until next '## '
    -- We use regexp to grab sections; anything before the first '## ' becomes preamble → project_overview.
    DECLARE
      blob text := proj.cloud_memory;
      preamble text;
      first_idx integer;
    BEGIN
      first_idx := position(E'\n## ' IN E'\n' || blob);
      IF first_idx = 0 THEN
        -- No headings at all — dump everything into project_overview
        buckets := jsonb_set(buckets, '{project_overview}', to_jsonb(blob));
      ELSE
        preamble := substring(E'\n' || blob FROM 1 FOR first_idx - 1);
        IF length(trim(preamble)) > 0 THEN
          buckets := jsonb_set(buckets, '{project_overview}', to_jsonb(trim(preamble)));
        END IF;

        FOR section_match IN
          SELECT (regexp_matches(
            blob,
            '^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s+|\Z)',
            'gm'
          )) AS m
        LOOP
          current_heading := section_match.m[1];
          current_body := section_match.m[2];
          aspect := _map_heading_to_aspect(current_heading);
          bucket_text := buckets ->> aspect::text;
          IF length(bucket_text) > 0 THEN
            bucket_text := bucket_text || E'\n\n';
          END IF;
          bucket_text := bucket_text || '## ' || current_heading || E'\n' || rtrim(current_body);
          buckets := jsonb_set(buckets, ARRAY[aspect::text], to_jsonb(bucket_text));
        END LOOP;
      END IF;
    END;

    -- Insert any non-empty buckets
    FOR aspect IN SELECT unnest(enum_range(NULL::aspect_type)) LOOP
      bucket_text := buckets ->> aspect::text;
      IF bucket_text IS NOT NULL AND length(trim(bucket_text)) > 0 THEN
        INSERT INTO project_memory_files (
          user_id, agency_id, project_name, aspect_type,
          content, content_hash, version, updated_by
        )
        VALUES (
          COALESCE(proj.updated_by, agency_owner),
          proj.agency_id,
          proj.project_name,
          aspect,
          bucket_text,
          encode(digest(bucket_text, 'sha256'), 'hex'),
          1,
          proj.updated_by
        )
        ON CONFLICT DO NOTHING;
        inserted_rows := inserted_rows + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN inserted_rows;
END;
$$ LANGUAGE plpgsql;

-- Requires pgcrypto for digest() — enabled by default on Supabase.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Run the backfill
SELECT _backfill_project_memory() AS rows_inserted;

-- Cleanup helper functions (the backfill is one-shot)
DROP FUNCTION _backfill_project_memory();
DROP FUNCTION _map_heading_to_aspect(text);
