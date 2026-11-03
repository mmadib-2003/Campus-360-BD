// apps/web/app/page.tsx
import React from 'react';
import Link from 'next/link';
import { ModuleHub } from '@/components/modules/ModuleHub';

const FEATURED_UNIVERSITIES = [
  { code: 'JU', name_en: 'Jahangirnagar University', name_bn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', domains: '@juniv.edu, @student.juniv.edu' },
  { code: 'DU', name_en: 'University of Dhaka', name_bn: 'ঢাকা বিশ্ববিদ্যালয়', domains: '@du.ac.bd, @students.du.ac.bd' },
  { code: 'BUET', name_en: 'Bangladesh University of Engineering & Technology', name_bn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়', domains: '@buet.ac.bd, @ug.buet.ac.bd' },
  { code: 'SUST', name_en: 'Shahjalal University of Science & Technology', name_bn: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', domains: '@sust.edu, @student.sust.edu' },
  { code: 'RU', name_en: 'University of Rajshahi', name_bn: 'রাজশাহী বিশ্ববিদ্যালয়', domains: '@ru.ac.bd' },
  { code: 'CU', name_en: 'University of Chittagong', name_bn: 'চট্টগ্রাম বিশ্ববিদ্যালয়', domains: '@cu.ac.bd, @std.cu.ac.bd' },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="p-8 rounded-2xl bg-gradient-to-br from-emerald-900/60 via-slate-900 to-teal-950 border border-emerald-500/30 shadow-xl">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
          🇧🇩 All 50+ Bangladesh Public Universities Supported
        </span>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mt-4">
          One Verified Super-App for Every Public University Campus in Bangladesh
        </h1>
        <p className="text-sm text-slate-300 mt-2 max-w-2xl">
          Strict institutional email OTP verification, row-level tenant isolation, 50 MB virus-scanned Academic Archive, SLA-tracked Anonymous Grievance Resolution, and Live Google Maps Campus Events.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow"
          >
            Join Your Campus / আপনার ক্যাম্পাসে যুক্ত হোন
          </Link>
          <Link
            href="/complaints/track"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
          >
            Track Grievance Case (JU-CASE-...)
          </Link>
        </div>
      </section>

      <ModuleHub />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Supported Public Universities Registry (50+ Seeded)</h2>
          <Link href="/signup" className="text-xs text-emerald-400 hover:underline">
            View Full Searchable Dropdown →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_UNIVERSITIES.map((u) => (
            <div
              key={u.code}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold text-xs">
                  {u.code}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{u.domains}</span>
              </div>
              <div className="font-semibold text-sm">{u.name_en}</div>
              <div className="text-xs text-slate-400">{u.name_bn}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
