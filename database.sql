-- create table public.payroll (
--   id uuid default gen_random_uuid() primary key,
--   employee_id uuid not null unique,
--   display_id text, -- Human-friendly Handle (e.g. EMP-101)
--   name text not null,
--   encrypted_salary text not null,
--   encrypted_tax text,
--   encrypted_insurance text,
--   encrypted_net_pay text,
--   encrypted_bank_account text not null,
--   created_at timestamp with time zone default timezone('utc'::text, now()) not null
-- );

-- -- If table already exists, run this instead:
-- -- ALTER TABLE public.payroll ADD COLUMN display_id text;

-- -- alter table public.payroll enable row level security;
-- -- create policy "Admin backend access" on public.payroll for all using (true) with check (true);