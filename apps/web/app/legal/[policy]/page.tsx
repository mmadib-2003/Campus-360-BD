// apps/web/app/legal/[policy]/page.tsx
// Static legal policy pages referenced by the footer's POLICY LINKS column:
// /legal/terms, /legal/privacy, /legal/return-refund, /legal/cancellation.
// Unknown slugs 404 (generateStaticParams drives the allow-list).
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PolicySection {
  heading: string;
  body: string[];
}

interface Policy {
  title: string;
  intro: string;
  sections: PolicySection[];
}

const LAST_UPDATED = '12 November 2026';
const CONTACT_EMAIL = 'ourcampus360bd@gmail.com';

const POLICIES: Record<string, Policy> = {
  terms: {
    title: 'Terms & Conditions',
    intro:
      'These Terms & Conditions govern your access to and use of Campus360 BD — the unified digital ecosystem for the public universities of Bangladesh. By creating an account or using any module of the platform, you accept these terms.',
    sections: [
      {
        heading: '1. Eligibility & accounts',
        body: [
          'Campus360 BD is open to currently enrolled students, faculty, staff, alumni and administration of supported public universities in Bangladesh. Registration requires a working institutional email address on a supported university domain, verified by a one-time passcode.',
          'You are responsible for keeping your credentials and OTP codes confidential. One person, one verified account; accounts are non-transferable and may not be shared, sold or lent.',
        ],
      },
      {
        heading: '2. Verification & trust levels',
        body: [
          'Access to sensitive capabilities (marketplace selling, grievance filing, hall registries) is gated by trust levels — Email Verified, ID Verified, and Trusted — awarded after institutional checks described in the app. Misrepresenting your identity, enrollment or affiliation is grounds for immediate suspension.',
        ],
      },
      {
        heading: '3. Acceptable use',
        body: [
          'You agree not to: harass, dox or defame any member; file knowingly false or frivolous grievances; list prohibited or counterfeit goods on the marketplace; scrape or bulk-extract data; attempt to bypass campus scoping, rate limits or access controls; or use the platform for any unlawful purpose under the laws of Bangladesh.',
        ],
      },
      {
        heading: '4. Marketplace, payments & fees',
        body: [
          'Campus360 BD connects buyers and sellers inside a verified campus community; it is not the seller of record for peer-to-peer listings unless expressly stated. Payments processed through integrated gateways (bKash, Nagad, aamarpay) are subject to those providers’ own terms. Any service fee, where applicable, is disclosed before you confirm a transaction.',
          'You are responsible for the accuracy of listings you publish and for honoring agreed handovers.',
        ],
      },
      {
        heading: '5. Content & intellectual property',
        body: [
          'Academic materials uploaded to the shared archive remain the property of their authors and are shared under the license you grant on upload (view/download within the ecosystem). Campus360 BD branding, design and code remain the property of Campus360 BD.',
        ],
      },
      {
        heading: '6. Suspension & termination',
        body: [
          'We may suspend or terminate access for breach of these terms, failed re-verification, or conduct that harms the community. Where practicable you will be notified by email with the reason and any appeal path.',
        ],
      },
      {
        heading: '7. Governing law & contact',
        body: [
          'These terms are governed by the laws of the People’s Republic of Bangladesh. Questions about these terms may be sent to ' + CONTACT_EMAIL + '.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This Privacy Policy explains what Campus360 BD collects, why, how we protect it, and the choices you have. It applies to the web app, API and related services.',
    sections: [
      {
        heading: '1. What we collect',
        body: [
          'Account data: institutional email, display name, role, your university, department, session and residential hall.',
          'Activity data: grievance tickets and evidence you file, marketplace listings, blood-donor registrations, event RSVPs and messages you send through the platform.',
          'Technical data: device/browser type, IP-derived region, and essential cookies (theme and language preference, session).',
        ],
      },
      {
        heading: '2. Why we collect it',
        body: [
          'To verify you belong to a supported campus, to scope every listing and ticket to the right university, to operate safety features (emergency blood support, grievance tracking), and to keep the platform reliable and abuse-free.',
        ],
      },
      {
        heading: '3. How we protect it',
        body: [
          'Data is stored in a Supabase/Postgres backend with row-level security: users see their own private records and campus-scoped public listings only. Access tokens are short-lived, secrets are kept server-side, and administrative access is least-privilege and audited.',
        ],
      },
      {
        heading: '4. What we never do',
        body: [
          'We do not sell your personal data, we do not run third-party ad trackers, and we never expose your private contact details publicly without your explicit action (for example, publishing a public listing).',
        ],
      },
      {
        heading: '5. Retention',
        body: [
          'Account data lives as long as your account is active. Verified grievance records are retained as required for institutional accountability. You may request deletion of your account and eligible personal data at any time.',
        ],
      },
      {
        heading: '6. Your rights',
        body: [
          'You may request access to, correction of, or deletion of your personal data, and you may withdraw consent for optional communications. Write to ' + CONTACT_EMAIL + ' from your institutional email and we will respond within a reasonable time.',
        ],
      },
      {
        heading: '7. Contact',
        body: [
          'Data-protection questions and requests: ' + CONTACT_EMAIL + '.',
        ],
      },
    ],
  },
  'return-refund': {
    title: 'Return & Refund Policy',
    intro:
      'This policy explains when and how refunds are issued for paid Campus360 BD services and transactions processed through our integrated gateways (bKash, Nagad, aamarpay).',
    sections: [
      {
        heading: '1. Scope',
        body: [
          'This policy covers payments made to Campus360 BD for platform services (for example, premium features or verified boosts, where offered). Peer-to-peer marketplace transactions are primarily between buyer and seller; Campus360 BD facilitates but is not a party to them, and returns/refunds for such transactions require the seller’s agreement unless the listing was materially false.',
        ],
      },
      {
        heading: '2. Refund eligibility',
        body: [
          'You may request a refund within 7 (seven) calendar days of payment if: the service was not delivered, was materially different from its description, or was billed to you in error.',
          'Refunds are not available for services already consumed in full, for concluded peer-to-peer marketplace handovers, or for claims raised after the 7-day window except where required by law.',
        ],
      },
      {
        heading: '3. How to request a refund',
        body: [
          'Email ' + CONTACT_EMAIL + ' from your registered institutional email with your transaction ID (bKash/Nagad/aamarpay), date and amount, the service purchased, and a short description of the issue. We acknowledge requests within 2 business days.',
        ],
      },
      {
        heading: '4. Processing time',
        body: [
          'Approved refunds are returned to the original payment method within 7–10 business days. Gateway and bank processing times may add a further 1–3 business days. You will receive a confirmation email when the refund is initiated.',
        ],
      },
      {
        heading: '5. Partial refunds',
        body: [
          'Where only part of a bundled service was unusable, we may issue a proportionate partial refund at our reasonable discretion, based on documented usage.',
        ],
      },
      {
        heading: '6. Contact',
        body: [
          'Refund questions: ' + CONTACT_EMAIL + ' or +8801722194398. Please include your transaction ID to avoid delays.',
        ],
      },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    intro:
      'This policy explains how you can cancel Campus360 BD services, marketplace orders and platform subscriptions, and what happens when you do.',
    sections: [
      {
        heading: '1. Cancelling your account',
        body: [
          'You may cancel your account at any time from in-app settings or by writing to ' + CONTACT_EMAIL + '. On cancellation your access ends immediately, public listings are unpublished, and personal data is deleted or anonymized in line with the Privacy Policy, except records we must retain for institutional accountability (for example, resolved grievance tickets).',
        ],
      },
      {
        heading: '2. Cancelling paid services',
        body: [
          'Paid subscriptions or one-off services can be cancelled before they are consumed in full. Cancellation stops all future charges; access continues until the end of the paid period. No cancellation fee is charged.',
        ],
      },
      {
        heading: '3. Marketplace order cancellation',
        body: [
          'Buyers may cancel a marketplace order before the seller accepts it or before handover; accepted orders are cancelled only by mutual agreement or for a materially false listing. Sellers may cancel before acceptance with no penalty.',
          'If a campus handover is agreed and either party fails to show, the aggrieved party should report the issue via the in-app grievance module or by emailing us with the order reference.',
        ],
      },
      {
        heading: '4. Event registrations & donations',
        body: [
          'Event RSVPs can be cancelled any time before the event starts; paid event tickets follow the Return & Refund Policy (7-day window). Donations once settled to a cause are final unless the campaign is cancelled by its organizer, in which case donors are refunded in full.',
        ],
      },
      {
        heading: '5. Effect on grievances',
        body: [
          'A grievance in progress continues to be tracked even if you cancel your account, because it remains part of the institutional record. You can withdraw a complaint you filed as long as no final resolution has been recorded.',
        ],
      },
      {
        heading: '6. Contact',
        body: [
          'Cancellation help: ' + CONTACT_EMAIL + ' or +8801722194398.',
        ],
      },
    ],
  },
};

const ORDER = ['terms', 'privacy', 'return-refund', 'cancellation'] as const;

export function generateStaticParams() {
  return ORDER.map((policy) => ({ policy }));
}

export function generateMetadata({ params }: { params: { policy: string } }): Metadata {
  const policy = POLICIES[params.policy];
  if (!policy) return { title: 'Policy — Campus360 BD' };
  return {
    title: `${policy.title} — Campus360 BD`,
    description: policy.intro.slice(0, 160),
  };
}

export default function LegalPolicyPage({ params }: { params: { policy: string } }) {
  const policy = POLICIES[params.policy];
  if (!policy) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <nav aria-label="Legal" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-emerald-500 transition-colors">Campus360 BD</Link>
        <span aria-hidden className="mx-2">›</span>
        <span className="text-emerald-600 dark:text-emerald-400">Legal</span>
      </nav>

      <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {policy.title}
      </h1>
      <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Last updated: {LAST_UPDATED}
      </p>
      <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{policy.intro}</p>

      <div className="mt-8 space-y-6">
        {policy.sections.map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-6"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index} className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      {/* Cross-links to the other policies */}
      <nav aria-label="Other policies" className="mt-10 flex flex-wrap gap-2">
        {ORDER.filter((slug) => slug !== params.policy).map((slug) => (
          <Link
            key={slug}
            href={`/legal/${slug}`}
            className="inline-flex items-center min-h-[40px] px-4 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            {POLICIES[slug].title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
