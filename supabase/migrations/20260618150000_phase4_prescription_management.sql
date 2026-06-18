-- Phase 4 prescription management schema.

DO $$
BEGIN
  CREATE TYPE public.prescription_status AS ENUM ('draft', 'finalized', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.prescription_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.next_prescription_number()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'RX-' || lpad(nextval('public.prescription_number_seq')::TEXT, 6, '0');
$$;

REVOKE EXECUTE ON FUNCTION public.next_prescription_number() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_number TEXT NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  encounter_id UUID NOT NULL REFERENCES public.patient_encounters(id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  diagnosis TEXT,
  chief_complaint TEXT,
  clinical_notes TEXT,
  instructions TEXT,
  status public.prescription_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT prescriptions_number_present_check CHECK (btrim(prescription_number) <> ''),
  CONSTRAINT prescriptions_finalized_diagnosis_check CHECK (
    status <> 'finalized' OR btrim(COALESCE(diagnosis, '')) <> ''
  )
);

CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE RESTRICT,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity TEXT,
  route TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT prescription_items_medicine_present_check CHECK (btrim(medicine_name) <> ''),
  CONSTRAINT prescription_items_dosage_present_check CHECK (btrim(dosage) <> ''),
  CONSTRAINT prescription_items_frequency_present_check CHECK (btrim(frequency) <> ''),
  CONSTRAINT prescription_items_duration_present_check CHECK (btrim(duration) <> '')
);

CREATE TABLE IF NOT EXISTS public.prescription_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  diagnosis TEXT,
  chief_complaint TEXT,
  clinical_notes TEXT,
  instructions TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT prescription_templates_name_present_check CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.prescription_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.prescription_templates(id) ON DELETE RESTRICT,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity TEXT,
  route TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT prescription_template_items_medicine_present_check CHECK (btrim(medicine_name) <> ''),
  CONSTRAINT prescription_template_items_dosage_present_check CHECK (btrim(dosage) <> ''),
  CONSTRAINT prescription_template_items_frequency_present_check CHECK (btrim(frequency) <> ''),
  CONSTRAINT prescription_template_items_duration_present_check CHECK (btrim(duration) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_number_uidx
  ON public.prescriptions(prescription_number);
CREATE INDEX IF NOT EXISTS prescriptions_patient_created_idx
  ON public.prescriptions(patient_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescriptions_doctor_created_idx
  ON public.prescriptions(doctor_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescriptions_encounter_idx
  ON public.prescriptions(encounter_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescriptions_status_idx
  ON public.prescriptions(status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescriptions_deleted_at_idx
  ON public.prescriptions(deleted_at);

CREATE INDEX IF NOT EXISTS prescription_items_prescription_idx
  ON public.prescription_items(prescription_id, created_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescription_items_deleted_at_idx
  ON public.prescription_items(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS prescription_templates_system_name_uidx
  ON public.prescription_templates(lower(name))
  WHERE is_system = true AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS prescription_templates_doctor_name_uidx
  ON public.prescription_templates(doctor_id, lower(name))
  WHERE doctor_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescription_templates_doctor_idx
  ON public.prescription_templates(doctor_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prescription_template_items_template_idx
  ON public.prescription_template_items(template_id, created_at)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.prepare_prescription_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encounter_patient_id UUID;
  encounter_doctor_id UUID;
  encounter_deleted_at TIMESTAMPTZ;
BEGIN
  IF NEW.prescription_number IS NULL OR btrim(NEW.prescription_number) = '' THEN
    NEW.prescription_number := public.next_prescription_number();
  END IF;

  SELECT patient_id, doctor_id, deleted_at
  INTO encounter_patient_id, encounter_doctor_id, encounter_deleted_at
  FROM public.patient_encounters
  WHERE id = NEW.encounter_id;

  IF encounter_patient_id IS NULL THEN
    RAISE EXCEPTION 'Selected encounter does not exist.';
  END IF;

  IF encounter_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Selected encounter is archived.';
  END IF;

  IF encounter_patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'Prescription patient must match the selected encounter.';
  END IF;

  IF encounter_doctor_id <> NEW.doctor_id THEN
    RAISE EXCEPTION 'Prescription doctor must match the selected encounter.';
  END IF;

  IF NEW.status = 'finalized' AND btrim(COALESCE(NEW.diagnosis, '')) = '' THEN
    RAISE EXCEPTION 'Diagnosis is required before finalizing a prescription.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_prescription_record()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prescriptions_prepare_record ON public.prescriptions;
CREATE TRIGGER prescriptions_prepare_record
BEFORE INSERT OR UPDATE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.prepare_prescription_record();

CREATE OR REPLACE FUNCTION public.prevent_non_admin_finalized_prescription_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unchanged_except_status_and_audit BOOLEAN;
BEGIN
  IF OLD.status <> 'draft'
    AND NOT public.has_role(auth.uid(), 'admin')
    AND COALESCE(auth.role(), '') <> 'service_role'
  THEN
    unchanged_except_status_and_audit :=
      (to_jsonb(OLD) - 'status' - 'updated_at' - 'updated_by') =
      (to_jsonb(NEW) - 'status' - 'updated_at' - 'updated_by');

    IF NOT (
      OLD.status = 'finalized'
      AND NEW.status = 'cancelled'
      AND unchanged_except_status_and_audit
    ) THEN
      RAISE EXCEPTION 'Finalized or cancelled prescriptions can only be changed by admins.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_non_admin_finalized_prescription_edits()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prescriptions_protect_finalized_record ON public.prescriptions;
CREATE TRIGGER prescriptions_protect_finalized_record
BEFORE UPDATE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.prevent_non_admin_finalized_prescription_edits();

DROP TRIGGER IF EXISTS prescriptions_audit_fields ON public.prescriptions;
CREATE TRIGGER prescriptions_audit_fields
BEFORE INSERT OR UPDATE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS prescription_items_audit_fields ON public.prescription_items;
CREATE TRIGGER prescription_items_audit_fields
BEFORE INSERT OR UPDATE ON public.prescription_items
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS prescription_templates_audit_fields ON public.prescription_templates;
CREATE TRIGGER prescription_templates_audit_fields
BEFORE INSERT OR UPDATE ON public.prescription_templates
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

DROP TRIGGER IF EXISTS prescription_template_items_audit_fields
ON public.prescription_template_items;
CREATE TRIGGER prescription_template_items_audit_fields
BEFORE INSERT OR UPDATE ON public.prescription_template_items
FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields();

GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prescription_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prescription_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prescription_template_items TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
GRANT ALL ON public.prescription_items TO service_role;
GRANT ALL ON public.prescription_templates TO service_role;
GRANT ALL ON public.prescription_template_items TO service_role;

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic staff view active prescriptions" ON public.prescriptions;
CREATE POLICY "Clinic staff view active prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
    OR public.has_role(auth.uid(), 'receptionist')
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Doctors and admins create prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors and admins create prescriptions"
ON public.prescriptions FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'doctor')
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.deleted_at IS NULL
        AND d.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Doctors and admins update prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors and admins update prescriptions"
ON public.prescriptions FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'doctor')
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.deleted_at IS NULL
        AND d.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'doctor')
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.deleted_at IS NULL
        AND d.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Clinic staff view prescription items" ON public.prescription_items;
CREATE POLICY "Clinic staff view prescription items"
ON public.prescription_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.prescriptions p
    WHERE p.id = prescription_id
      AND (p.deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'doctor')
        OR public.has_role(auth.uid(), 'receptionist')
      )
  )
  AND (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Doctors and admins create prescription items" ON public.prescription_items;
CREATE POLICY "Doctors and admins create prescription items"
ON public.prescription_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.prescriptions p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id
    WHERE p.id = prescription_id
      AND p.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'doctor')
          AND p.status = 'draft'
          AND d.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Doctors and admins update prescription items" ON public.prescription_items;
CREATE POLICY "Doctors and admins update prescription items"
ON public.prescription_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.prescriptions p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id
    WHERE p.id = prescription_id
      AND p.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'doctor')
          AND p.status = 'draft'
          AND d.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.prescriptions p
    LEFT JOIN public.doctors d ON d.id = p.doctor_id
    WHERE p.id = prescription_id
      AND p.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'doctor')
          AND p.status = 'draft'
          AND d.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Doctors and admins view templates" ON public.prescription_templates;
CREATE POLICY "Doctors and admins view templates"
ON public.prescription_templates FOR SELECT TO authenticated
USING (
  (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
  )
);

DROP POLICY IF EXISTS "Doctors and admins create templates" ON public.prescription_templates;
CREATE POLICY "Doctors and admins create templates"
ON public.prescription_templates FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'doctor')
    AND is_system = false
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.deleted_at IS NULL
        AND d.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Doctors and admins update templates" ON public.prescription_templates;
CREATE POLICY "Doctors and admins update templates"
ON public.prescription_templates FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'doctor')
    AND is_system = false
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.deleted_at IS NULL
        AND d.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'doctor')
    AND is_system = false
    AND EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.deleted_at IS NULL
        AND d.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Doctors and admins view template items" ON public.prescription_template_items;
CREATE POLICY "Doctors and admins view template items"
ON public.prescription_template_items FOR SELECT TO authenticated
USING (
  (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1
    FROM public.prescription_templates t
    WHERE t.id = template_id
      AND (t.deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'))
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'doctor')
      )
  )
);

DROP POLICY IF EXISTS "Doctors and admins create template items" ON public.prescription_template_items;
CREATE POLICY "Doctors and admins create template items"
ON public.prescription_template_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.prescription_templates t
    LEFT JOIN public.doctors d ON d.id = t.doctor_id
    WHERE t.id = template_id
      AND t.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'doctor')
          AND t.is_system = false
          AND d.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Doctors and admins update template items" ON public.prescription_template_items;
CREATE POLICY "Doctors and admins update template items"
ON public.prescription_template_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.prescription_templates t
    LEFT JOIN public.doctors d ON d.id = t.doctor_id
    WHERE t.id = template_id
      AND t.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'doctor')
          AND t.is_system = false
          AND d.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.prescription_templates t
    LEFT JOIN public.doctors d ON d.id = t.doctor_id
    WHERE t.id = template_id
      AND t.deleted_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'doctor')
          AND t.is_system = false
          AND d.user_id = auth.uid()
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.can_manage_prescription_document(
  _patient_id UUID,
  _file_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  path_patient_id UUID;
  path_prescription_id UUID;
BEGIN
  IF _file_path IS NULL OR _file_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/prescriptions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.+\.pdf$' THEN
    RETURN false;
  END IF;

  path_patient_id := split_part(_file_path, '/', 1)::UUID;
  path_prescription_id := split_part(_file_path, '/', 3)::UUID;

  IF path_patient_id <> _patient_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.prescriptions p
    JOIN public.doctors d ON d.id = p.doctor_id
    WHERE p.id = path_prescription_id
      AND p.patient_id = _patient_id
      AND p.status = 'finalized'
      AND p.deleted_at IS NULL
      AND d.deleted_at IS NULL
      AND d.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_link_prescription_document(
  _document_id UUID,
  _prescription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  document_patient_id UUID;
  document_file_path TEXT;
BEGIN
  SELECT patient_id, file_path
  INTO document_patient_id, document_file_path
  FROM public.patient_documents
  WHERE id = _document_id
    AND document_type = 'prescription'
    AND mime_type = 'application/pdf'
    AND deleted_at IS NULL;

  IF document_patient_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_manage_prescription_document(document_patient_id, document_file_path)
    AND document_file_path LIKE document_patient_id::TEXT || '/prescriptions/' || _prescription_id::TEXT || '/%'
    AND EXISTS (
      SELECT 1
      FROM public.prescriptions p
      WHERE p.id = _prescription_id
        AND p.patient_id = document_patient_id
        AND p.status = 'finalized'
        AND p.deleted_at IS NULL
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_prescription_document(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_link_prescription_document(UUID, UUID)
FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Doctors create prescription documents" ON public.patient_documents;
CREATE POLICY "Doctors create prescription documents"
ON public.patient_documents FOR INSERT TO authenticated
WITH CHECK (
  document_type = 'prescription'
  AND mime_type = 'application/pdf'
  AND public.has_role(auth.uid(), 'doctor')
  AND public.can_manage_prescription_document(patient_id, file_path)
);

DROP POLICY IF EXISTS "Doctors create prescription document links" ON public.document_entity_links;
CREATE POLICY "Doctors create prescription document links"
ON public.document_entity_links FOR INSERT TO authenticated
WITH CHECK (
  entity_type = 'prescription'
  AND public.has_role(auth.uid(), 'doctor')
  AND public.can_link_prescription_document(document_id, entity_id)
);

DROP POLICY IF EXISTS "Patient document files uploadable by doctors" ON storage.objects;
CREATE POLICY "Patient document files uploadable by doctors"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-documents'
  AND public.has_role(auth.uid(), 'doctor')
  AND lower(name) LIKE '%.pdf'
  AND EXISTS (
    SELECT 1
    FROM public.prescriptions p
    JOIN public.doctors d ON d.id = p.doctor_id
    WHERE p.status = 'finalized'
      AND p.deleted_at IS NULL
      AND d.deleted_at IS NULL
      AND d.user_id = auth.uid()
      AND name LIKE p.patient_id::TEXT || '/prescriptions/' || p.id::TEXT || '/%'
  )
);

REVOKE DELETE ON public.prescriptions FROM authenticated;
REVOKE DELETE ON public.prescription_items FROM authenticated;
REVOKE DELETE ON public.prescription_templates FROM authenticated;
REVOKE DELETE ON public.prescription_template_items FROM authenticated;

WITH template_data(name, diagnosis, chief_complaint, clinical_notes, instructions) AS (
  VALUES
    ('Fever', 'Acute febrile illness', 'Fever with body ache', 'Assess temperature, hydration, and warning signs.', 'Hydration, rest, and follow up if fever persists beyond 48 hours.'),
    ('Cold', 'Upper respiratory tract infection', 'Runny nose and cough', 'Likely viral symptoms. Check throat, chest, and temperature.', 'Steam inhalation, fluids, and return if breathing difficulty or persistent fever occurs.'),
    ('Hypertension', 'Hypertension follow-up', 'Elevated blood pressure', 'Review blood pressure log, adherence, salt intake, and symptoms.', 'Low-salt diet, regular BP monitoring, and medication adherence.'),
    ('Diabetes', 'Diabetes mellitus follow-up', 'Blood sugar review', 'Review glucose log, diet, activity, and medication adherence.', 'Diet control, regular sugar checks, foot care, and scheduled follow-up.'),
    ('Dental Cleaning', 'Dental prophylaxis', 'Routine cleaning', 'Plaque/calculus removal and oral hygiene counseling.', 'Warm saline rinses and oral hygiene maintenance.'),
    ('Root Canal', 'Endodontic treatment follow-up', 'Tooth pain', 'Evaluate pain, swelling, occlusion, and restoration status.', 'Avoid chewing on treated tooth until final restoration.')
),
inserted_templates AS (
  INSERT INTO public.prescription_templates (
    name,
    diagnosis,
    chief_complaint,
    clinical_notes,
    instructions,
    is_system
  )
  SELECT name, diagnosis, chief_complaint, clinical_notes, instructions, true
  FROM template_data
  ON CONFLICT DO NOTHING
  RETURNING id, name
),
all_templates AS (
  SELECT id, name
  FROM inserted_templates
  UNION
  SELECT id, name
  FROM public.prescription_templates
  WHERE is_system = true
    AND deleted_at IS NULL
    AND name IN ('Fever', 'Cold', 'Hypertension', 'Diabetes', 'Dental Cleaning', 'Root Canal')
),
template_items(template_name, medicine_name, dosage, frequency, duration, quantity, route, notes) AS (
  VALUES
    ('Fever', 'Paracetamol', '500 mg', 'Every 6 hours as needed', '3 days', '10 tablets', 'Oral', 'Avoid exceeding recommended daily dose.'),
    ('Fever', 'ORS', '1 sachet', 'After loose stools or dehydration', '3 days', '6 sachets', 'Oral', 'Mix with clean water.'),
    ('Cold', 'Cetirizine', '10 mg', 'Once daily at night', '5 days', '5 tablets', 'Oral', 'May cause drowsiness.'),
    ('Cold', 'Saline nasal drops', '2 drops', 'Three times daily', '5 days', '1 bottle', 'Nasal', 'Use as needed for congestion.'),
    ('Hypertension', 'Amlodipine', '5 mg', 'Once daily', '30 days', '30 tablets', 'Oral', 'Monitor ankle swelling and BP.'),
    ('Diabetes', 'Metformin', '500 mg', 'Twice daily after food', '30 days', '60 tablets', 'Oral', 'Take with meals.'),
    ('Dental Cleaning', 'Chlorhexidine mouthwash', '10 ml', 'Twice daily', '7 days', '1 bottle', 'Oral rinse', 'Do not swallow.'),
    ('Root Canal', 'Ibuprofen', '400 mg', 'Twice daily after food', '3 days', '6 tablets', 'Oral', 'Avoid if gastritis, kidney disease, or allergy.')
)
INSERT INTO public.prescription_template_items (
  template_id,
  medicine_name,
  dosage,
  frequency,
  duration,
  quantity,
  route,
  notes
)
SELECT
  t.id,
  i.medicine_name,
  i.dosage,
  i.frequency,
  i.duration,
  i.quantity,
  i.route,
  i.notes
FROM template_items i
JOIN all_templates t ON t.name = i.template_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.prescription_template_items existing
  WHERE existing.template_id = t.id
    AND lower(existing.medicine_name) = lower(i.medicine_name)
    AND existing.deleted_at IS NULL
);
