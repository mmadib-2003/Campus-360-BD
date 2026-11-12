import React from 'react';
import { LegalPage } from '@/components/welcome/LegalPage';

export const metadata = { title: 'Privacy — Campus360 BD' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy & Data Retention"
      intro="A plain-language summary of how Campus360 BD handles your data."
      points={[
        'The academic archive, complaint evidence and ID verification buckets are private; none of them is publicly readable.',
        'Student ID card images uploaded for verification are scheduled for permanent deletion 7 days after upload and are purged after review.',
        'Anonymous grievances store no student identity; they are tracked only through a keyed hash of your tracking secret.',
        'Each campus is a separate tenant: your records are scoped to your university and role.',
      ]}
    />
  );
}
