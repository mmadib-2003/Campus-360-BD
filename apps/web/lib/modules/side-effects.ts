// apps/web/lib/modules/side-effects.ts
import type { RequestAuth } from '@/lib/request-context';
import type { ModuleSpec } from './registry';
import { normalizeTokenList } from './coerce';

type Row = Record<string, unknown>;

interface SideEffectArgs {
  spec: ModuleSpec;
  auth: RequestAuth;
  row: Row;
  payload: Row;
}

async function notify(
  auth: RequestAuth,
  entries: Array<{
    user_id: string;
    title_en: string;
    title_bn: string;
    body_en: string;
    body_bn: string;
    action_url: string;
    category: string;
  }>
) {
  if (!entries.length) return;
  const unique = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    if (!entry.user_id || entry.user_id === auth.user.id) continue;
    unique.set(`${entry.user_id}:${entry.category}:${entry.action_url}`, entry);
  }
  if (!unique.size) return;
  await auth.admin.from('notifications').insert(
    [...unique.values()].map((entry) => ({
      ...entry,
      university_id: auth.profile.university_id,
    }))
  );
}

/**
 * Post-insert fan-out used by the realtime notification centre.
 * Failures are swallowed by the caller — the primary write must always stand.
 */
export async function runModuleSideEffects({ spec, auth, row, payload }: SideEffectArgs) {
  const universityId = auth.profile.university_id;

  switch (spec.key) {
    /* Module 5 — Smart Blood Bank emergency broadcast ------------------ */
    case 'blood-requests': {
      const group = String(row.blood_group ?? '');
      const urgency = String(row.urgency ?? 'URGENT');
      const { data: donors } = await auth.admin
        .from('health_donors')
        .select('user_id, blood_group, is_available')
        .eq('university_id', universityId)
        .eq('blood_group', group)
        .eq('is_available', true)
        .limit(200);

      await notify(
        auth,
        (donors ?? []).map((d) => ({
          user_id: String(d.user_id),
          title_en: `${urgency} ${group} blood needed`,
          title_bn: `${group} রক্তের জরুরি প্রয়োজন`,
          body_en: `${row.patient_name} needs ${row.bags_needed} bag(s) at ${row.hospital_name}. Open the Smart Blood Bank to respond.`,
          body_bn: `${row.hospital_name}-এ ${row.bags_needed} ব্যাগ রক্ত প্রয়োজন। স্মার্ট ব্লাড ব্যাংকে সাড়া দিন।`,
          action_url: `/health?tab=donors&group=${encodeURIComponent(group)}`,
          category: 'BLOOD_REQUEST',
        }))
      );
      break;
    }

    /* Module 2 — Skill matches ---------------------------------------- */
    case 'skills': {
      const skills = (row.skills as string[] | null) ?? [];
      const haystack = [row.title, row.description, row.category, ...skills].join(' ');
      const tokens = normalizeTokenList(haystack);
      if (!tokens.length) break;

      const { data: alerts } = await auth.admin
        .from('skill_alerts')
        .select('user_id, keywords, categories')
        .eq('university_id', universityId)
        .limit(500);

      await notify(
        auth,
        (alerts ?? [])
          .filter((alert) => {
            const keywords = (alert.keywords as string[] | null) ?? [];
            const categories = (alert.categories as string[] | null) ?? [];
            if (categories.length && categories.includes(String(row.category ?? ''))) return true;
            return keywords.some((k) => tokens.includes(String(k).toLowerCase()));
          })
          .map((alert) => ({
            user_id: String(alert.user_id),
            title_en: `New match: ${row.title}`,
            title_bn: `নতুন ম্যাচ: ${row.title}`,
            body_en: `A ${row.type} posting matching your skills was just published.`,
            body_bn: 'আপনার দক্ষতার সাথে মিলে এমন একটি নতুন পোস্ট প্রকাশিত হয়েছে।',
            action_url: '/skills',
            category: 'SKILL_MATCH',
          }))
      );
      break;
    }

    /* Module 10 — Lost & Found realtime matching ---------------------- */
    case 'lost-found': {
      const kind = String(row.kind ?? 'LOST');
      const opposite = kind === 'LOST' ? 'FOUND' : 'LOST';
      const tokens = normalizeTokenList([
        String(row.title ?? ''),
        String(row.description ?? ''),
        String(row.category ?? ''),
        ...((row.keywords as string[] | null) ?? []),
      ]);
      if (!tokens.length) break;

      const { data: candidates } = await auth.admin
        .from('lost_items')
        .select('id, reporter_id, title, description, category, keywords, kind')
        .eq('university_id', universityId)
        .eq('kind', opposite)
        .eq('status', 'OPEN')
        .limit(300);

      const matches: Array<{ id: string; reporter_id: string; title: string; score: number }> = [];
      for (const candidate of candidates ?? []) {
        const candidateTokens = normalizeTokenList([
          String(candidate.title ?? ''),
          String(candidate.description ?? ''),
          String(candidate.category ?? ''),
          ...((candidate.keywords as string[] | null) ?? []),
        ]);
        const overlap = candidateTokens.filter((t) => tokens.includes(t));
        const uniqueOverlap = [...new Set(overlap)];
        const strongMatch =
          uniqueOverlap.length >= 2 ||
          (uniqueOverlap.length >= 1 && String(candidate.category) === String(row.category));
        if (strongMatch) {
          matches.push({
            id: String(candidate.id),
            reporter_id: String(candidate.reporter_id),
            title: String(candidate.title),
            score: uniqueOverlap.length * 10,
          });
        }
      }

      if (!matches.length) break;

      await auth.admin.from('lost_item_matches').upsert(
        matches.map((match) => ({
          university_id: universityId,
          lost_item_id: kind === 'LOST' ? row.id : match.id,
          found_item_id: kind === 'LOST' ? match.id : row.id,
          score: match.score,
          notified: true,
        })),
        { onConflict: 'lost_item_id,found_item_id', ignoreDuplicates: true }
      );

      await notify(
        auth,
        matches.map((match) => ({
          user_id: match.reporter_id,
          title_en: 'Possible match found for your item',
          title_bn: 'আপনার আইটেমের সম্ভাব্য মিল পাওয়া গেছে',
          body_en: `"${row.title}" may match your "${match.title}" report. Open Lost & Found to connect.`,
          body_bn: `"${row.title}" আপনার রিপোর্টের সাথে মিলতে পারে। লস্ট অ্যান্ড ফাউন্ডে যোগাযোগ করুন।`,
          action_url: '/lost-found',
          category: 'LOST_FOUND_MATCH',
        }))
      );
      break;
    }

    /* Module 3 — Complaint upvote milestone --------------------------- */
    case 'complaint-upvotes': {
      const complaintId = String(row.complaint_id ?? '');
      if (!complaintId) break;
      const { data: complaint } = await auth.admin
        .from('complaints')
        .select('id, title, tracking_code, upvotes_count, student_id, assigned_unit_id')
        .eq('id', complaintId)
        .maybeSingle();
      if (!complaint) break;
      if (Number(complaint.upvotes_count ?? 0) < 5) break;

      const { data: officers } = await auth.admin
        .from('user_roles')
        .select('user_id')
        .eq('university_id', universityId)
        .in('role', ['GOVERNING_BODY', 'UNIVERSITY_ADMIN'])
        .limit(50);

      await notify(
        auth,
        (officers ?? []).map((officer) => ({
          user_id: String(officer.user_id),
          title_en: `Ticket trending: ${complaint.title}`,
          title_bn: `টিকিট জনপ্রিয়: ${complaint.title}`,
          body_en: `${complaint.upvotes_count} students upvoted ${complaint.tracking_code}. Please review.`,
          body_bn: `${complaint.upvotes_count} জন শিক্ষার্থী ভোট দিয়েছেন (${complaint.tracking_code})।`,
          action_url: '/admin/console',
          category: 'COMPLAINT_TRENDING',
        }))
      );
      break;
    }

    /* Module 1 — Marketplace order ----------------------------------- */
    case 'marketplace-orders': {
      const { data: listing } = await auth.admin
        .from('marketplace_listings')
        .select('id, title, seller_id')
        .eq('id', row.listing_id as string)
        .maybeSingle();
      if (!listing) break;
      await auth.admin
        .from('marketplace_listings')
        .update({ status: 'RESERVED' })
        .eq('id', listing.id as string);
      await notify(auth, [
        {
          user_id: String(listing.seller_id),
          title_en: 'New marketplace order',
          title_bn: 'নতুন মার্কেটপ্লেস অর্ডার',
          body_en: `${auth.profile.full_name} placed order ${row.order_code} for "${listing.title}".`,
          body_bn: `${auth.profile.full_name} "${listing.title}" এর জন্য অর্ডার করেছেন।`,
          action_url: '/marketplace',
          category: 'MARKETPLACE_ORDER',
        },
      ]);
      break;
    }

    /* Module 4 — Club join request ----------------------------------- */
    case 'club-members': {
      const { data: club } = await auth.admin
        .from('clubs')
        .select('id, name_en')
        .eq('id', row.club_id as string)
        .maybeSingle();
      if (!club) break;
      break;
    }

    /* Module 8 — Direct message -------------------------------------- */
    case 'messages': {
      const { data: conversation } = await auth.admin
        .from('direct_conversations')
        .select('id, user_a, user_b')
        .eq('id', row.conversation_id as string)
        .maybeSingle();
      if (!conversation) break;
      const counterpart =
        String(conversation.user_a) === auth.user.id ? String(conversation.user_b) : String(conversation.user_a);
      await auth.admin
        .from('direct_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id as string);
      await notify(auth, [
        {
          user_id: counterpart,
          title_en: 'New message',
          title_bn: 'নতুন বার্তা',
          body_en: `${auth.profile.full_name}: ${String(row.body ?? '').slice(0, 120)}`,
          body_bn: `${auth.profile.full_name} একটি বার্তা পাঠিয়েছেন।`,
          action_url: '/careers',
          category: 'DIRECT_MESSAGE',
        },
      ]);
      break;
    }

    /* Module 9 — Food order ------------------------------------------ */
    case 'food-orders': {
      if (row.food_listing_id) {
        const { data: listing } = await auth.admin
          .from('home_food_listings')
          .select('cook_id, title')
          .eq('id', row.food_listing_id as string)
          .maybeSingle();
        if (listing) {
          await notify(auth, [
            {
              user_id: String(listing.cook_id),
              title_en: 'New food order',
              title_bn: 'নতুন খাবারের অর্ডার',
              body_en: `Order ${row.order_code} placed for "${listing.title}".`,
              body_bn: `"${listing.title}" এর জন্য নতুন অর্ডার এসেছে।`,
              action_url: '/dining',
              category: 'FOOD_ORDER',
            },
          ]);
        }
      }
      break;
    }

    /* Module 7 — Rideshare match ------------------------------------- */
    case 'rideshare': {
      const { data: requests } = await auth.admin
        .from('rideshare_requests')
        .select('id, user_id, destination, depart_at')
        .eq('university_id', universityId)
        .eq('status', 'OPEN')
        .limit(200);
      const destination = String(row.destination ?? '').toLowerCase();
      const matches = (requests ?? []).filter(
        (request) =>
          String(request.destination ?? '').toLowerCase().includes(destination.slice(0, 4)) ||
          destination.includes(String(request.destination ?? '').toLowerCase().slice(0, 4))
      );
      await notify(
        auth,
        matches.map((match) => ({
          user_id: String(match.user_id),
          title_en: `Rideshare match to ${row.destination}`,
          title_bn: `${row.destination} রাইডশেয়ার ম্যাচ`,
          body_en: `A ${row.mode} leaving ${row.origin} was just posted with ${row.seats_available} seat(s).`,
          body_bn: `${row.origin} থেকে নতুন ${row.mode} পাওয়া গেছে।`,
          action_url: '/housing',
          category: 'RIDESHARE_MATCH',
        }))
      );
      break;
    }

    /* Module 11 — Donation transparency ------------------------------ */
    case 'donations': {
      const { data: campaign } = await auth.admin
        .from('donation_campaigns')
        .select('id, title, organizer_id, raised_bdt')
        .eq('id', row.campaign_id as string)
        .maybeSingle();
      if (!campaign) break;
      await auth.admin.from('donation_ledger').insert({
        university_id: universityId,
        campaign_id: campaign.id,
        entry_type: 'DONATION',
        amount_bdt: row.amount_bdt,
        description: `Donation ${row.donor_name ?? 'Anonymous'}`,
      });
      await notify(auth, [
        {
          user_id: String(campaign.organizer_id),
          title_en: 'New donation received',
          title_bn: 'নতুন অনুদান পাওয়া গেছে',
          body_en: `${row.donor_name ?? 'A student'} donated ৳${row.amount_bdt} to "${campaign.title}".`,
          body_bn: `"${campaign.title}" ক্যাম্পেইনে ৳${row.amount_bdt} অনুদান এসেছে।`,
          action_url: '/sports',
          category: 'DONATION',
        },
      ]);
      break;
    }

    default:
      break;
  }

  // Generic audit trail (best effort).
  await auth.admin
    .from('audit_log')
    .insert({
      university_id: universityId,
      actor_id: auth.user.id,
      action: `${spec.key.toUpperCase().replace(/-/g, '_')}_CREATE`,
      entity_type: spec.table,
      entity_id: row.id as string,
      metadata: { payload_keys: Object.keys(payload) },
    })
    .then(
      () => undefined,
      () => undefined
    );
}
