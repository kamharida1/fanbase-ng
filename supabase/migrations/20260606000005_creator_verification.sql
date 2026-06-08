-- Creator verification request fields on profiles
alter table profiles
  add column if not exists verification_note             text,
  add column if not exists verification_rejected_reason  text;

-- Allow creators to update their own verification_note and kyc_status (pending only)
-- RLS already allows creators to select their own profile row;
-- we need a policy that lets them set kyc_status = 'pending'.
-- The admin client (service_role) bypasses RLS for approval/rejection.
create policy "creator_can_request_verification" on profiles
  for update to authenticated
  using  (id = auth.uid())
  with check (
    id = auth.uid()
    AND kyc_status IN ('none', 'pending', 'rejected')
  );
