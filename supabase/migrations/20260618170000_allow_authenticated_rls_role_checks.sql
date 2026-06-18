-- RLS policies call public.has_role(auth.uid(), ...). Authenticated users must
-- be allowed to execute the helper for policy evaluation to succeed.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
