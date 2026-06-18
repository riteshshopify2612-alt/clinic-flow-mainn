-- Phase 2 appointment management schema

DO $$
BEGIN
  CREATE TYPE public.appointment_status AS ENUM (
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_date DATE,
  ADD COLUMN IF NOT EXISTS appointment_time TIME,
  ADD COLUMN IF NOT EXISTS visit_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.appointments
SET
  appointment_date = COALESCE(appointment_date, scheduled_at::date),
  appointment_time = COALESCE(appointment_time, scheduled_at::time)
WHERE scheduled_at IS NOT NULL;

UPDATE public.appointments
SET status = 'scheduled'
WHERE status NOT IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

ALTER TABLE public.appointments
  ALTER COLUMN appointment_date SET NOT NULL,
  ALTER COLUMN appointment_time SET NOT NULL,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.appointment_status USING status::public.appointment_status,
  ALTER COLUMN status SET DEFAULT 'scheduled'::public.appointment_status;

ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS scheduled_at,
  DROP COLUMN IF EXISTS fee;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey,
  ADD CONSTRAINT appointments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey,
  ADD CONSTRAINT appointments_doctor_id_fkey
    FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE patient_id IS NULL) THEN
    ALTER TABLE public.appointments ALTER COLUMN patient_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE doctor_id IS NULL) THEN
    ALTER TABLE public.appointments ALTER COLUMN doctor_id SET NOT NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);
CREATE INDEX IF NOT EXISTS appointments_doctor_date_time_idx
  ON public.appointments(doctor_id, appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS doctor_leaves_doctor_date_idx
  ON public.doctor_leaves(doctor_id, start_date, end_date);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_active_double_booking_idx
  ON public.appointments(doctor_id, appointment_date, appointment_time)
  WHERE status IN ('scheduled', 'confirmed');

DROP POLICY IF EXISTS "Authenticated manage patients" ON public.patients;
CREATE POLICY "Admin and reception manage patients"
ON public.patients FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

DROP POLICY IF EXISTS "Authenticated manage appointments" ON public.appointments;
CREATE POLICY "Admin and reception manage appointments"
ON public.appointments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'receptionist')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctors_status_check'
  ) THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_status_check CHECK (status IN ('active', 'inactive'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_leaves_status_check'
  ) THEN
    ALTER TABLE public.doctor_leaves
      ADD CONSTRAINT doctor_leaves_status_check CHECK (status IN ('approved', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_leaves_date_order_check'
  ) THEN
    ALTER TABLE public.doctor_leaves
      ADD CONSTRAINT doctor_leaves_date_order_check CHECK (end_date >= start_date);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  old_status public.appointment_status,
  new_status public.appointment_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.appointment_status_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.appointment_status_history FROM authenticated;
GRANT ALL ON public.appointment_status_history TO service_role;

ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Status history viewable by authenticated" ON public.appointment_status_history;
CREATE POLICY "Status history viewable by authenticated"
ON public.appointment_status_history FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated manage status history" ON public.appointment_status_history;

CREATE INDEX IF NOT EXISTS appointment_status_history_appointment_id_idx
  ON public.appointment_status_history(appointment_id, changed_at DESC);

INSERT INTO public.appointment_status_history (appointment_id, old_status, new_status, changed_at)
SELECT a.id, NULL, a.status, a.created_at
FROM public.appointments a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.appointment_status_history h
  WHERE h.appointment_id = a.id
);

CREATE OR REPLACE FUNCTION public.record_appointment_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_status_history (appointment_id, old_status, new_status)
    VALUES (NEW.id, NULL, NEW.status);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.appointment_status_history (appointment_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_appointment_status_history()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_record_status_history ON public.appointments;
CREATE TRIGGER appointments_record_status_history
AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.record_appointment_status_history();
