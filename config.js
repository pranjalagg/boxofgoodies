// Fill these in from Supabase → Project Settings → API.
// The anon key is meant to be public; access is limited by the policies in supabase/schema.sql.
// Leave empty to run without a backend: links then carry the package in the URL
// and photo/video uploads are disabled.
export const SUPABASE_URL = 'https://bwgdtldqflaaqkxisuvz.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_67hI0QnJ94zKPY384cfWCg_6jv-v1zR';

// Packages made from a local dev server are tagged 'dev' (and their uploads go under dev/),
// so test data stays apart from what real users send. Everything else is 'prod'.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
export const ENV =
  LOCAL_HOSTS.includes(location.hostname) || location.hostname.endsWith('.localhost') ? 'dev' : 'prod';
