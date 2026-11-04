#!/usr/bin/env node
/**
 * Idempotently provision the four public showcase accounts through GoTrue's
 * Admin API (never raw SQL against auth.users). Required env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: pnpm --filter @campus360/web provision:demo-users
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const accounts = [
  { role: 'student', email: 'student@demo.campus360.test', name: 'Demo Student', studentId: 'DU-2026-12345', appRole: 'STUDENT' },
  { role: 'faculty', email: 'faculty@demo.campus360.test', name: 'Demo Faculty', studentId: 'DU-FAC-0142', appRole: 'FACULTY' },
  { role: 'admin', email: 'admin@demo.campus360.test', name: 'Demo Admin', studentId: 'DU-ADM-001', appRole: 'ADMIN' },
  { role: 'alumni', email: 'alumni@demo.campus360.test', name: 'Demo Alumni', studentId: 'DU-ALM-2019-088', appRole: 'ALUMNI' },
];
const password = 'Demo#1234';

const { data: university, error: universityError } = await supabase
  .from('universities').select('id').eq('code', 'DU').single();
if (universityError || !university) throw universityError ?? new Error('DU university not found');

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

for (const account of accounts) {
  const existing = listed.users.find((user) => user.email?.toLowerCase() === account.email);
  const appMetadata = {
    provider: 'email', providers: ['email'],
    ...(account.role === 'admin' ? { is_platform_admin: true } : {}),
  };
  const result = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password, email_confirm: true,
        user_metadata: { ...existing.user_metadata, university_code: 'DU', full_name: account.name },
        app_metadata: appMetadata,
      })
    : await supabase.auth.admin.createUser({
        email: account.email, password, email_confirm: true,
        user_metadata: { university_code: 'DU', full_name: account.name },
        app_metadata: appMetadata,
      });
  if (result.error || !result.data.user) throw result.error ?? new Error(`No Auth user returned for ${account.email}`);

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: result.data.user.id, university_id: university.id, email: account.email,
    full_name: account.name, student_id: account.studentId,
    trust_level: 'ID_VERIFIED', onboarding_completed: true,
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const { error: roleError } = await supabase.from('user_roles').upsert({
    user_id: result.data.user.id, university_id: university.id, role: account.appRole,
  }, { onConflict: 'user_id,university_id,role' });
  if (roleError) throw roleError;
  console.log(`Provisioned ${account.role} demo identity via Auth Admin API.`);
}
