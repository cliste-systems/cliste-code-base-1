/** Must match hosted Supabase Auth `mailer_otp_length`. */
export const SIGNUP_EMAIL_OTP_LENGTH = 8;

export const SIGNUP_EMAIL_OTP_INPUT_MAX = SIGNUP_EMAIL_OTP_LENGTH;

export const SIGNUP_EMAIL_OTP_PATTERN = new RegExp(
  `^\\d{${SIGNUP_EMAIL_OTP_LENGTH}}$`,
);
