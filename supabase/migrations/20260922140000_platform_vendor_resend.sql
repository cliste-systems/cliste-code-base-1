-- Rename SendGrid → Resend in platform vendor spend tracker (if already seeded).

update public.platform_vendor_costs
set
  vendor_key = 'resend',
  display_name = 'Resend',
  dashboard_url = 'https://resend.com/settings/billing',
  notes = 'Transactional email.'
where vendor_key = 'sendgrid';
