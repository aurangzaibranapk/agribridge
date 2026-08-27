-- Multiple sign-up paths now exist (mobile+password, email+password,
-- Google, Facebook) and not all of them provide a phone number up front
-- (Google/Facebook only ever give an email + name). phone_number becomes
-- optional — a farmer can add it later from their profile, same as
-- everything else that isn't collected at signup. The existing unique
-- constraint (migration 012) is untouched and still safe: Postgres
-- treats multiple NULLs in a unique column as distinct, not duplicates.
alter table farmers alter column phone_number drop not null;
