// apps/web/components/welcome/pillars.ts
// The four-pillar progressive-disclosure map for the Welcome screen.
//
// Every sub-module reuses MODULE_META (lib/modules/labels.ts) — the same
// registry the dashboard ModuleHub renders — so the Welcome preview can never
// drift from the real modules. Only routes that have no MODULE_META entry
// (Academic Archives, Club Management, donor finder, emergency support) carry
// a local one-line description here.

import { MODULE_META } from '@/lib/modules/labels';

export interface PillarItem {
  icon: string;
  title: string;
  titleBn: string;
  blurb: string;
  blurbBn: string;
  href: string;
  /** The MODULE_META key this entry represents, when it maps to one. */
  metaKey?: string;
}

export interface Pillar {
  id: string;
  icon: string;
  title: string;
  titleBn: string;
  tagline: string;
  taglineBn: string;
  items: PillarItem[];
}

function fromMeta(key: string, overrides: Partial<PillarItem> = {}): PillarItem {
  const meta = MODULE_META[key];
  return {
    icon: overrides.icon ?? meta.icon,
    title: overrides.title ?? meta.title,
    titleBn: overrides.titleBn ?? meta.titleBn,
    blurb: overrides.blurb ?? meta.blurb,
    blurbBn: overrides.blurbBn ?? meta.blurbBn,
    href: overrides.href ?? meta.href,
    metaKey: key,
  };
}

const ARCHIVE_ITEM: PillarItem = {
  icon: '📚',
  title: 'Academic Archives',
  titleBn: 'একাডেমিক আর্কাইভ',
  blurb: 'Virus-scanned 50 MB document archive with course-wise search.',
  blurbBn: 'ভাইরাস স্ক্যান করা ৫০ মেগাবাইট ডকুমেন্ট আর্কাইভ, কোর্স অনুযায়ী খুঁজুন।',
  href: '/archive',
};

const CLUBS_ITEM: PillarItem = {
  icon: '🎪',
  title: 'Club Management',
  titleBn: 'ক্লাব ব্যবস্থাপনা',
  blurb: 'Run club recruitment, memberships and events from one dashboard.',
  blurbBn: 'এক ড্যাশবোর্ড থেকে ক্লাব নিয়োগ, সদস্যপদ ও ইভেন্ট পরিচালনা করুন।',
  href: '/events',
};

const DONORS_ITEM: PillarItem = {
  icon: '❤️',
  title: 'Live Donor Finder',
  titleBn: 'লাইভ ডোনার ফাইন্ডার',
  blurb: 'Match blood requests with available donors in real time.',
  blurbBn: 'রক্তের অনুরোধের সাথে উপলব্ধ ডোনারদের রিয়েল-টাইমে মিলিয়ে দিন।',
  href: '/health?tab=donors',
};

const EMERGENCY_ITEM: PillarItem = {
  icon: '🚑',
  title: 'Emergency Campus Support',
  titleBn: 'জরুরি ক্যাম্পাস সাপোর্ট',
  blurb: 'Campus ambulance helplines and anonymous counselling, on call.',
  blurbBn: 'ক্যাম্পাস অ্যাম্বুলেন্স হেল্পলাইন ও নামহীন কাউন্সেলিং, সবসময় পাশে।',
  href: '/health',
};

export const PILLARS: Pillar[] = [
  {
    id: 'academic',
    icon: '🎓',
    title: 'Academic & Career Hub',
    titleBn: 'একাডেমিক ও ক্যারিয়ার হাব',
    tagline: 'Study smarter, learn from peers, and launch your career.',
    taglineBn: 'স্মার্টভাবে পড়ুন, পিয়ারদের কাছ থেকে শিখুন, ক্যারিয়ার গড়ুন।',
    items: [
      ARCHIVE_ITEM,
      fromMeta('skills', { title: 'Skill Hub', titleBn: 'স্কিল হাব' }),
      fromMeta('mentorship', { title: 'Peer Learning & Mentorship', titleBn: 'পিয়ার লার্নিং ও মেন্টরশিপ' }),
      fromMeta('careers'),
    ],
  },
  {
    id: 'life',
    icon: '🌿',
    title: 'Campus Life & Circular Economy',
    titleBn: 'ক্যাম্পাস লাইফ ও সার্কুলার ইকোনমি',
    tagline: 'Trade, find, gather and play — everything campus life needs.',
    taglineBn: 'কেনাবেচা, খুঁজে পাওয়া, আড্ডা ও খেলা — ক্যাম্পাস জীবনের সবকিছু।',
    items: [
      fromMeta('marketplace'),
      fromMeta('lostfound'),
      fromMeta('events', { title: 'Event Calendar', titleBn: 'ইভেন্ট ক্যালেন্ডার' }),
      CLUBS_ITEM,
      fromMeta('dining'),
      fromMeta('sports'),
    ],
  },
  {
    id: 'health',
    icon: '🩸',
    title: 'Emergency & Health Network',
    titleBn: 'জরুরি ও স্বাস্থ্য নেটওয়ার্ক',
    tagline: 'Life-saving blood matching and confidential support, 24/7.',
    taglineBn: 'জীবন বাঁচানো রক্ত মিলানো ও গোপনীয় সাপোর্ট, ২৪/৭।',
    items: [
      fromMeta('health', { title: 'Smart Blood Bank', titleBn: 'স্মার্ট ব্লাড ব্যাংক' }),
      DONORS_ITEM,
      EMERGENCY_ITEM,
    ],
  },
  {
    id: 'governance',
    icon: '🏛️',
    title: 'Hall & Campus Governance',
    titleBn: 'হল ও ক্যাম্পাস গভর্নেন্স',
    tagline: 'Verified halls, tracked grievances and role-based portals.',
    taglineBn: 'যাচাইকৃত হল, ট্র্যাক করা অভিযোগ ও রোল-ভিত্তিক পোর্টাল।',
    items: [
      fromMeta('housing', { title: 'Residential Hall Registries', titleBn: 'আবাসিক হল রেজিস্ট্রি' }),
      fromMeta('civic', { title: 'Grievance & Complaint Tracking', titleBn: 'অভিযোগ ট্র্যাকিং' }),
      fromMeta('trust', { title: 'Role-Based Portals', titleBn: 'রোল-ভিত্তিক পোর্টাল' }),
    ],
  },
];

/**
 * Every MODULE_META key must appear in exactly one pillar (zero feature loss).
 * The Academic Archive and the role-based portals are module routes too, so
 * they are listed here explicitly.
 */
export function pillarModuleKeys(): string[] {
  const keys: string[] = [];
  for (const pillar of PILLARS) {
    for (const item of pillar.items) {
      if (item.metaKey && !keys.includes(item.metaKey)) keys.push(item.metaKey);
    }
  }
  return keys;
}
