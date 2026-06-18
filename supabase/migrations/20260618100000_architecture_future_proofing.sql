-- Architecture future-proofing for Phase 4 modules.
-- This migration adds a shared encounter spine, consistent audit columns,
-- safer foreign keys, doctor-to-auth-user linkage, and generic document links.

DO $$
BEGIN
  CREATE TYPE public.encounter_type AS ENUM (
    'opd',
    'follow_up',
    'teleconsultation',
    'emergency',
    'ipd'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.encounter_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.document_entity_type AS ENUM (
    'patient',
    'encounter',
    'prescription',
    'invoice',
    'lab_report',
    'admission'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.doctor_leaves
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.appointment_status_history
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.patient_medical_notes
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patients_deleted_by_fkey') THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_user_id_fkey') THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_created_by_fkey') THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_updated_by_fkey') THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctors_deleted_by_fkey') THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_leaves_created_by_fkey') THEN
    ALTER TABLE public.doctor_leaves
      ADD CONSTRAINT doctor_leaves_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_leaves_updated_by_fkey') THEN
    ALTER TABLE public.doctor_leaves
      ADD CONSTRAINT doctor_leaves_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_leaves_deleted_by_fkey') THEN
    ALTER TABLE public.doctor_leaves
      ADD CONSTRAINT doctor_leaves_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_created_by_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_updated_by_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_deleted_by_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_status_history_created_by_fkey'
  ) THEN
    ALTER TABLE public.appointment_status_history
      ADD CONSTRAINT appointment_status_history_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_status_history_updated_by_fkey'
  ) THEN
    ALTER TABLE public.appointment_status_history
      ADD CONSTRAINT appointment_status_history_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_status_history_deleted_by_fkey'
  ) THEN
    ALTER TABLE public.appointment_status_history
      ADD CONSTRAINT appointment_status_history_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_medical_notes_deleted_by_fkey'
  ) THEN
    ALTER TABLE public.patient_medical_notes
      ADD CONSTRAINT patient_medical_notes_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_documents_deleted_by_fkey'
  ) THEN
    ALTER TABLE public.patient_documents
      ADD CONSTRAINT patient_documents_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS doctors_user_id_uidx
  ON public.doctors(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS doctors_deleted_at_idx ON public.doctors(deleted_at);
CREATE INDEX IF NOT EXISTS doctor_leaves_deleted_at_idx ON public.doctor_leaves(deleted_at);
CREATE INDEX IF NOT EXISTS appointments_deleted_at_idx ON public.appointments(deleted_at);
CREATE INDEX IF NOT EXISTS appointment_status_history_deleted_at_idx
  ON public.appointment_status_history(deleted_at);
CREATE INDEX IF NOT EXISTS patient_medical_notes_deleted_at_idx
  ON public.patient_medical_notes(deleted_at);
CREATE INDEX IF NOT EXISTS patient_documents_deleted_at_idx ON public.patient_documents(deleted_at);

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey,
  ADD CONSTRAINT appointments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey,
  ADD CONSTRAINT appointments_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE RESTRICT;

ALTER TABLE public.doctor_leaves
  DROP CONSTRAINT IF EXISTS doctor_leaves_doctor_id_fkey,
  ADD CONSTRAINT doctor_leaves_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE RESTRICT;

ALTER TABLE public.appointment_status_history
  DROP CONSTRAINT IF EXISTS appointment_status_history_appointment_id_fkey,
  ADD CONSTRAINT appointment_status_history_appointment_id_fkey
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT;

ALTER TABLE public.patient_medical_notes
  DROP CONSTRAINT IF EXISTS patient_medical_notes_patient_id_fkey,
  ADD CONSTRAINT patient_medical_notes_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

ALTER TABLE public.patient_documents
  DROP CONSTRAINT IF EXISTS patient_documents_patient_id_fkey,
  ADD CONSTRAINT patient_documents_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.set_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := COALESCE(NEW.updated_at, NEW.created_at, now());
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_by := COALESCE(NEW.deleted_by, auth.uid());
    END IF;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
    NEW.updated_at := now();

    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      IF NEW.deleted_at IS NOT NULL THEN
        NEW.deleted_by := COALESCE(auth.uid(), NEW.deleted_by, OLD.deleted_by);
      ELSE
        NEW.deleted_by := NULL;
      END IF;
    ELSE
      NEW.deleted_by := OLD.deleted_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_audit_fields() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_patient_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    AND auth.uid() IS NOT NULL
    AND NOT public.has_role(auth.uid(), 'admin')
  THEN
    RAISE EXCEPTION 'Only admins can archive or restore patients.';
  END IF;

  IF NEW.patient_code IS NULL OR btrim(NEW.patient_code) = '' THEN
    NEW.patient_code := 'PAT-' || lpad(nextval('public.patient_code_seq')::TEXT, 6, '0');
  END IF;

  NEW.first_name := NULLIF(btrim(NEW.first_name), '');
  NEW.last_name := COALESCE(btrim(NEW.last_name), '');

  IF NEW.first_name IS NULL THEN
    NEW.first_name := NULLIF(split_part(btrim(COALESCE(NEW.full_name, '')), ' ', 1), '');
  END IF;

  IF NEW.first_name IS NULL THEN
    RAISE EXCEPTION 'First name is required.';
  END IF;

  NEW.full_name := btrim(concat_ws(' ', NEW.first_name, NULLIF(NEW.last_name, '')));
  NEW.dob := NEW.date_of_birth;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := COALESCE(NEW.updated_at, NEW.created_at, now());
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_by := COALESCE(NEW.deleted_by, auth.uid());
    END IF;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
    NEW.updated_at := now();

    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      IF NEW.deleted_at IS NOT NULL THEN
        NEW.deleted_by := COALESCE(auth.uid(), NEW.deleted_by, OLD.deleted_by);
      ELSE
        NEW.deleted_by := NULL;
      END IF;
    ELSE
      NEW.deleted_by := OLD.deleted_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_patient_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS doctors_audit_fields ON public.doctors;
CREATE TRIGGER doctors_audit_fields
BEFORE INSERT OR UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS doctor_leaves_audit_fields ON public.doctor_leaves;
CREATE TRIGGER doctor_leaves_audit_fields
BEFORE INSERT OR UPDATE ON public.doctor_leaves
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
DROP TRIGGER IF EXISTS appointments_audit_fields ON public.appointments;
CREATE TRIGGER appointments_audit_fields
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS appointment_status_history_audit_fields
ON public.appointment_status_history;
CREATE TRIGGER appointment_status_history_audit_fields
BEFORE INSERT OR UPDATE ON public.appointment_status_history
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS patient_medical_notes_audit_fields ON public.patient_medical_notes;
CREATE TRIGGER patient_medical_notes_audit_fields
BEFORE INSERT OR UPDATE ON public.patient_medical_notes
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS patient_documents_audit_fields ON public.patient_documents;
CREATE TRIGGER patient_documents_audit_fields
BEFORE INSERT OR UPDATE ON public.patient_documents
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

CREATE TABLE IF NOT EXISTS public.patient_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  appointment_id UUID UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
  encounter_type public.encounter_type NOT NULL DEFAULT 'opd',
  status public.encounter_status NOT NULL DEFAULT 'planned',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT patient_encounters_time_order_check CHECK (
    ended_at IS NULL OR ended_at >= started_at
  )
);

GRANT SELECT, INSERT, UPDATE ON public.patient_encounters TO authenticated;
GRANT ALL ON public.patient_encounters TO service_role;
ALTER TABLE public.patient_encounters ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS patient_encounters_audit_fields ON public.patient_encounters;
CREATE TRIGGER patient_encounters_audit_fields
BEFORE INSERT OR UPDATE ON public.patient_encounters
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

CREATE INDEX IF NOT EXISTS patient_encounters_patient_started_idx
  ON public.patient_encounters(patient_id, started_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_encounters_doctor_started_idx
  ON public.patient_encounters(doctor_id, started_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_encounters_type_status_idx
  ON public.patient_encounters(encounter_type, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patient_encounters_deleted_at_idx
  ON public.patient_encounters(deleted_at);

INSERT INTO public.patient_encounters (
  patient_id,
  doctor_id,
  appointment_id,
  encounter_type,
  status,
  started_at,
  ended_at,
  notes,
  created_at,
  updated_at,
  created_by,
  updated_by,
  deleted_at,
  deleted_by
)
SELECT
  a.patient_id,
  a.doctor_id,
  a.id,
  'opd'::public.encounter_type,
  CASE
    WHEN a.status = 'completed' THEN 'completed'::public.encounter_status
    WHEN a.status IN ('cancelled', 'no_show') THEN 'cancelled'::public.encounter_status
    ELSE 'planned'::public.encounter_status
  END,
  (a.appointment_date + a.appointment_time)::TIMESTAMPTZ,
  CASE
    WHEN a.status = 'completed' THEN (a.appointment_date + a.appointment_time)::TIMESTAMPTZ + INTERVAL '30 minutes'
    ELSE NULL
  END,
  COALESCE(a.visit_reason, a.notes),
  a.created_at,
  a.updated_at,
  a.created_by,
  a.updated_by,
  a.deleted_at,
  a.deleted_by
FROM public.appointments a
WHERE a.patient_id IS NOT NULL
  AND a.doctor_id IS NOT NULL
ON CONFLICT (appointment_id) DO NOTHING;

DROP INDEX IF EXISTS appointments_no_active_double_booking_idx;
CREATE UNIQUE INDEX appointments_no_active_double_booking_idx
  ON public.appointments(doctor_id, appointment_date, appointment_time)
  WHERE status IN ('scheduled', 'confirmed') AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.document_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.patient_documents(id) ON DELETE RESTRICT,
  entity_type public.document_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (document_id, entity_type, entity_id)
);

GRANT SELECT, INSERT, UPDATE ON public.document_entity_links TO authenticated;
GRANT ALL ON public.document_entity_links TO service_role;
ALTER TABLE public.document_entity_links ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS document_entity_links_audit_fields ON public.document_entity_links;
CREATE TRIGGER document_entity_links_audit_fields
BEFORE INSERT OR UPDATE ON public.document_entity_links
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

CREATE INDEX IF NOT EXISTS document_entity_links_document_idx
  ON public.document_entity_links(document_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_entity_links_entity_idx
  ON public.document_entity_links(entity_type, entity_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_entity_links_deleted_at_idx
  ON public.document_entity_links(deleted_at);

INSERT INTO public.document_entity_links (
  document_id,
  entity_type,
  entity_id,
  created_by,
  updated_by,
  created_at,
  updated_at,
  deleted_at,
  deleted_by
)
SELECT
  d.id,
  'patient'::public.document_entity_type,
  d.patient_id,
  d.created_by,
  d.updated_by,
  d.created_at,
  d.updated_at,
  d.deleted_at,
  d.deleted_by
FROM public.patient_documents d
ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_patient_document_patient_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.document_entity_links (
    document_id,
    entity_type,
    entity_id,
    created_by,
    updated_by,
    deleted_at,
    deleted_by
  )
  VALUES (
    NEW.id,
    'patient'::public.document_entity_type,
    NEW.patient_id,
    NEW.created_by,
    NEW.updated_by,
    NEW.deleted_at,
    NEW.deleted_by
  )
  ON CONFLICT (document_id, entity_type, entity_id)
  DO UPDATE SET
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = EXCLUDED.deleted_at,
    deleted_by = EXCLUDED.deleted_by;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_patient_document_patient_link()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patient_documents_patient_link ON public.patient_documents;
CREATE TRIGGER patient_documents_patient_link
AFTER INSERT OR UPDATE OF patient_id, deleted_at, deleted_by ON public.patient_documents
FOR EACH ROW EXECUTE FUNCTION public.ensure_patient_document_patient_link();

DROP POLICY IF EXISTS "Clinic staff view active encounters" ON public.patient_encounters;
DROP POLICY IF EXISTS "Clinic staff create encounters" ON public.patient_encounters;
DROP POLICY IF EXISTS "Clinic staff update encounters" ON public.patient_encounters;

CREATE POLICY "Clinic staff view active encounters"
ON public.patient_encounters FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Clinic staff create encounters"
ON public.patient_encounters FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'doctor')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Clinic staff update encounters"
ON public.patient_encounters FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'doctor')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'doctor')
  OR public.has_role(auth.uid(), 'receptionist')
);

DROP POLICY IF EXISTS "Document links viewable by clinic staff" ON public.document_entity_links;
DROP POLICY IF EXISTS "Document links create by document managers" ON public.document_entity_links;
DROP POLICY IF EXISTS "Document links update by document managers" ON public.document_entity_links;

CREATE POLICY "Document links viewable by clinic staff"
ON public.document_entity_links FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Document links create by document managers"
ON public.document_entity_links FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Document links update by document managers"
ON public.document_entity_links FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

DROP POLICY IF EXISTS "Admins manage doctors" ON public.doctors;
DROP POLICY IF EXISTS "Doctors viewable by authenticated" ON public.doctors;
DROP POLICY IF EXISTS "Clinic staff view active doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins create doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins update doctors" ON public.doctors;
CREATE POLICY "Clinic staff view active doctors"
ON public.doctors FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins create doctors"
ON public.doctors FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update doctors"
ON public.doctors FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Leaves viewable by authenticated" ON public.doctor_leaves;
DROP POLICY IF EXISTS "Admins manage leaves" ON public.doctor_leaves;
DROP POLICY IF EXISTS "Clinic staff view active leaves" ON public.doctor_leaves;
DROP POLICY IF EXISTS "Admins create leaves" ON public.doctor_leaves;
DROP POLICY IF EXISTS "Admins update leaves" ON public.doctor_leaves;
CREATE POLICY "Clinic staff view active leaves"
ON public.doctor_leaves FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins create leaves"
ON public.doctor_leaves FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update leaves"
ON public.doctor_leaves FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin and reception manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Appointments viewable by authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Clinic staff view active appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin and reception create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin and reception update appointments" ON public.appointments;
CREATE POLICY "Clinic staff view active appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admin and reception create appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Admin and reception update appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

DROP POLICY IF EXISTS "Admins hard delete patients" ON public.patients;

DROP POLICY IF EXISTS "Patient notes viewable by clinic staff" ON public.patient_medical_notes;
DROP POLICY IF EXISTS "Doctors and admins create patient notes" ON public.patient_medical_notes;
DROP POLICY IF EXISTS "Doctors update own patient notes" ON public.patient_medical_notes;
DROP POLICY IF EXISTS "Admins delete patient notes" ON public.patient_medical_notes;

CREATE POLICY "Patient notes viewable by clinic staff"
ON public.patient_medical_notes FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Doctors and admins create patient notes"
ON public.patient_medical_notes FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'doctor')
);

CREATE POLICY "Doctors update own patient notes"
ON public.patient_medical_notes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'doctor') AND created_by = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'doctor') AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Patient documents viewable by clinic staff" ON public.patient_documents;
DROP POLICY IF EXISTS "Admin and reception create patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Admin and reception update patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Admin and reception delete patient documents" ON public.patient_documents;

CREATE POLICY "Patient documents viewable by clinic staff"
ON public.patient_documents FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admin and reception create patient documents"
ON public.patient_documents FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Admin and reception update patient documents"
ON public.patient_documents FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE OR REPLACE VIEW public.patient_statistics
WITH (security_invoker = true)
AS
SELECT
  p.id AS patient_id,
  COUNT(a.id)::INTEGER AS total_appointments,
  COUNT(a.id) FILTER (WHERE a.status = 'completed')::INTEGER AS completed_appointments,
  COUNT(a.id) FILTER (
    WHERE a.status IN ('scheduled', 'confirmed')
      AND a.appointment_date >= CURRENT_DATE
  )::INTEGER AS upcoming_appointments,
  MAX(a.appointment_date) FILTER (WHERE a.status = 'completed') AS last_visit_date
FROM public.patients p
LEFT JOIN public.appointments a ON a.patient_id = p.id AND a.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id;

GRANT SELECT ON public.patient_statistics TO authenticated;

REVOKE DELETE ON public.patients FROM authenticated;
REVOKE DELETE ON public.doctors FROM authenticated;
REVOKE DELETE ON public.doctor_leaves FROM authenticated;
REVOKE DELETE ON public.appointments FROM authenticated;
REVOKE DELETE ON public.appointment_status_history FROM authenticated;
REVOKE DELETE ON public.patient_medical_notes FROM authenticated;
REVOKE DELETE ON public.patient_documents FROM authenticated;
REVOKE DELETE ON public.patient_encounters FROM authenticated;
REVOKE DELETE ON public.document_entity_links FROM authenticated;
