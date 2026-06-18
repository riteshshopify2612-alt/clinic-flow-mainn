-- Keep appointment-to-encounter links intact under the soft-delete strategy.
ALTER TABLE public.patient_encounters
  DROP CONSTRAINT IF EXISTS patient_encounters_appointment_id_fkey,
  ADD CONSTRAINT patient_encounters_appointment_id_fkey
    FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE RESTRICT;
