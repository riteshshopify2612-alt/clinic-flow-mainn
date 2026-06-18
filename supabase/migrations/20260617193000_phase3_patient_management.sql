-- Phase 3 patient management schema

CREATE SEQUENCE IF NOT EXISTS public.patient_code_seq START WITH 1;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_code TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS current_medications TEXT,
  ADD COLUMN IF NOT EXISTS medical_history TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

UPDATE public.patients
SET
  first_name = COALESCE(NULLIF(btrim(first_name), ''), NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Unknown'),
  last_name = COALESCE(
    NULLIF(btrim(last_name), ''),
    NULLIF(btrim(regexp_replace(COALESCE(full_name, ''), '^\S+\s*', '')), ''),
    ''
  ),
  date_of_birth = COALESCE(date_of_birth, dob),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE first_name IS NULL
  OR last_name IS NULL
  OR date_of_birth IS NULL
  OR updated_at IS NULL;

UPDATE public.patients
SET patient_code = 'PAT-' || lpad(nextval('public.patient_code_seq')::TEXT, 6, '0')
WHERE patient_code IS NULL OR btrim(patient_code) = '';

SELECT setval(
  'public.patient_code_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(NULLIF(regexp_replace(patient_code, '\D', '', 'g'), '')::BIGINT)
        FROM public.patients
      ),
      0
    ) + 1,
    1
  ),
  false
);

ALTER TABLE public.patients
  ALTER COLUMN patient_code SET DEFAULT ('PAT-' || lpad(nextval('public.patient_code_seq')::TEXT, 6, '0')),
  ALTER COLUMN patient_code SET NOT NULL,
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_created_by_fkey'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_updated_by_fkey'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_first_name_present_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_first_name_present_check CHECK (btrim(first_name) <> '');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_gender_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_gender_check CHECK (
        gender IS NULL OR gender IN ('male', 'female', 'other', 'unknown')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_blood_group_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_blood_group_check CHECK (
        blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_date_of_birth_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_date_of_birth_check CHECK (
        date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE
      );
  END IF;
END $$;

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
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_patient_record() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patients_prepare_record ON public.patients;
CREATE TRIGGER patients_prepare_record
BEFORE INSERT OR UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.prepare_patient_record();

CREATE UNIQUE INDEX IF NOT EXISTS patients_patient_code_uidx ON public.patients(patient_code);
CREATE INDEX IF NOT EXISTS patients_active_name_idx
  ON public.patients(last_name, first_name)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS patients_active_phone_idx
  ON public.patients(phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS patients_active_email_idx
  ON public.patients(email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS patients_deleted_at_idx ON public.patients(deleted_at);
CREATE INDEX IF NOT EXISTS appointments_patient_status_date_idx
  ON public.appointments(patient_id, status, appointment_date);
CREATE INDEX IF NOT EXISTS appointments_patient_date_idx
  ON public.appointments(patient_id, appointment_date DESC);

DROP POLICY IF EXISTS "Patients viewable by authenticated" ON public.patients;
DROP POLICY IF EXISTS "Authenticated manage patients" ON public.patients;
DROP POLICY IF EXISTS "Admin and reception manage patients" ON public.patients;

CREATE POLICY "Clinic staff view active patients"
ON public.patients FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admin and reception create patients"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Admin and reception update patients"
ON public.patients FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Admins hard delete patients"
ON public.patients FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.patient_medical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medical_notes TO authenticated;
GRANT ALL ON public.patient_medical_notes TO service_role;
ALTER TABLE public.patient_medical_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'other',
  mime_type TEXT NOT NULL,
  file_size BIGINT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_documents_mime_type_check CHECK (
    mime_type IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  CONSTRAINT patient_documents_file_size_check CHECK (
    file_size IS NULL OR file_size >= 0
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_documents TO authenticated;
GRANT ALL ON public.patient_documents TO service_role;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

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
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_audit_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patient_medical_notes_audit_fields ON public.patient_medical_notes;
CREATE TRIGGER patient_medical_notes_audit_fields
BEFORE INSERT OR UPDATE ON public.patient_medical_notes
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS patient_documents_audit_fields ON public.patient_documents;
CREATE TRIGGER patient_documents_audit_fields
BEFORE INSERT OR UPDATE ON public.patient_documents
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

CREATE INDEX IF NOT EXISTS patient_medical_notes_patient_created_idx
  ON public.patient_medical_notes(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_medical_notes_created_by_idx
  ON public.patient_medical_notes(created_by);
CREATE INDEX IF NOT EXISTS patient_documents_patient_created_idx
  ON public.patient_documents(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_documents_patient_type_idx
  ON public.patient_documents(patient_id, document_type);
CREATE INDEX IF NOT EXISTS patient_documents_created_by_idx
  ON public.patient_documents(created_by);

DROP POLICY IF EXISTS "Patient notes viewable by clinic staff" ON public.patient_medical_notes;
DROP POLICY IF EXISTS "Doctors and admins create patient notes" ON public.patient_medical_notes;
DROP POLICY IF EXISTS "Doctors update own patient notes" ON public.patient_medical_notes;
DROP POLICY IF EXISTS "Admins delete patient notes" ON public.patient_medical_notes;

CREATE POLICY "Patient notes viewable by clinic staff"
ON public.patient_medical_notes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'doctor')
  OR public.has_role(auth.uid(), 'receptionist')
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

CREATE POLICY "Admins delete patient notes"
ON public.patient_medical_notes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Patient documents viewable by clinic staff" ON public.patient_documents;
DROP POLICY IF EXISTS "Admin and reception create patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Admin and reception update patient documents" ON public.patient_documents;
DROP POLICY IF EXISTS "Admin and reception delete patient documents" ON public.patient_documents;

CREATE POLICY "Patient documents viewable by clinic staff"
ON public.patient_documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'doctor')
  OR public.has_role(auth.uid(), 'receptionist')
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

CREATE POLICY "Admin and reception delete patient documents"
ON public.patient_documents FOR DELETE TO authenticated
USING (
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
LEFT JOIN public.appointments a ON a.patient_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id;

GRANT SELECT ON public.patient_statistics TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-documents',
  'patient-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Patient document files readable by clinic staff" ON storage.objects;
DROP POLICY IF EXISTS "Patient document files uploadable by admin reception" ON storage.objects;
DROP POLICY IF EXISTS "Patient document files updatable by admin reception" ON storage.objects;
DROP POLICY IF EXISTS "Patient document files deletable by admin reception" ON storage.objects;

CREATE POLICY "Patient document files readable by clinic staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
);

CREATE POLICY "Patient document files uploadable by admin reception"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
  )
);

CREATE POLICY "Patient document files updatable by admin reception"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
  )
)
WITH CHECK (
  bucket_id = 'patient-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
  )
);

CREATE POLICY "Patient document files deletable by admin reception"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-documents'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'receptionist')
  )
);
