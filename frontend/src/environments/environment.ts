/**
 * Production settings. Only public values belong here: the Supabase project URL and its
 * PUBLISHABLE key (sb_publishable_...). Never put the secret key or database password in the
 * frontend; those stay in the backend's environment.
 */
export const environment = {
  production: true,
  /** The Spring Boot API on Render; every /api/... request goes there. Placeholder: replace it. */
  apiBaseUrl: 'https://rezumo-api.onrender.com' ,
  supabaseUrl: 'https://dxfkjkozfngvcabvrrah.supabase.co',
  supabasePublishableKey: 'sb_publishable_HZ9qQSYUERg_ILRB_eliEg_KTv0-kzw',
};
