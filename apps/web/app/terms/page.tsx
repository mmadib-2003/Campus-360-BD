import React from 'react';
import { LegalPage } from '@/components/welcome/LegalPage';

export const metadata = { title: 'Terms — Campus360 BD' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The basics you agree to when you create a Campus360 BD account."
      points={[
        'Accounts are for members of supported public universities and require a verified institutional email address.',
        'You agree to uphold the Campus Community Guidelines: be respectful, honest and safe in every module.',
        'Listings, reviews, complaints and events must be truthful; misuse can lead to moderation or removal of access.',
        'Use of your data is described in the Privacy & Data Retention summary.',
      ]}
    />
  );
}
