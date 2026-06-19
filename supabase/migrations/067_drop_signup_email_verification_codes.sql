-- Unused: signup OTP verification uses Supabase generateLink + verifyOtp instead.
drop table if exists public.signup_email_verification_codes;
