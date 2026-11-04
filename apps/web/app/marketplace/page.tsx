// apps/web/app/marketplace/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChips,
  Input,
  Modal,
  ModuleHeader,
  SectionHeader,
  Select,
  SignInPrompt,
  SkeletonList,
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { ModuleForm } from '@/components/modules/ModuleForm';
import { useModuleMutation, useRealtimeModuleList, useSession, Row } from '@/lib/modules/client';
import { formatBdt, timeAgo } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';

const KIND_LABEL: Record<string, string> = {
  SELL: 'For sale',
  RENT: 'For rent',
  EXCHANGE: 'Exchange',
  WANTED: 'Wanted',
};

export default function MarketplacePage() {
  const session = useSession();
  const { locale, t } = useUi();
  const [kindFilter, setKindFilter] = React.useState('ALL');
  const [categoryFilter, setCategoryFilter] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [activeListing, setActiveListing] = React.useState<Row | null>(null);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [checkoutListing, setCheckoutListing] = React.useState<Row | null>(null);
  const [pickupPointId, setPickupPointId] = React.useState('');
  const [meetupWindow, setMeetupWindow] = React.useState('');
  const [orderNote, setOrderNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const toast = useToast();

  const listings = useRealtimeModuleList('marketplace', {
    filters: { kind: kindFilter, category: categoryFilter },
    search,
    limit: 60,
    enabled: !!session.authenticated,
  });
  const pickupPoints = useRealtimeModuleList('marketplace-pickup-points', { enabled: !!session.authenticated });
  const orders = useRealtimeModuleList('marketplace-orders', { limit: 10, enabled: !!session.authenticated });
  const { create } = useModuleMutation('marketplace');
  const orderMutation = useModuleMutation('marketplace-orders');

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    listings.data.forEach((row) => {
      if (row.category) set.add(String(row.category));
    });
    return [...set].sort();
  }, [listings.data]);

  const pickupOptions = React.useMemo(
    () =>
      pickupPoints.data.map((point) => ({
        value: String(point.id),
        label: `${point.name_en} — ${point.location_en}`,
      })),
    [pickupPoints.data]
  );

  async function handleCreate(values: Row) {
    const result = await create(values);
    if (result.ok) {
      setCreateOpen(false);
      listings.refresh();
      toast.show('Listing published — classmates can see it now.');
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  async function handlePlaceOrder() {
    if (!checkoutListing) return;
    if (!pickupPointId) {
      toast.show('Choose a campus pickup point for a safe handover.', 'amber');
      return;
    }
    setSubmitting(true);
    const result = await orderMutation.create({
      listing_id: checkoutListing.id,
      seller_id: checkoutListing.seller_id,
      amount_bdt: checkoutListing.price_bdt ?? 0,
      pickup_point_id: pickupPointId,
      meetup_window: meetupWindow || null,
      note: orderNote || null,
    });
    setSubmitting(false);
    if (result.ok) {
      setCheckoutOpen(false);
      setCheckoutListing(null);
      setPickupPointId('');
      setMeetupWindow('');
      setOrderNote('');
      orders.refresh();
      listings.refresh();
      toast.show('Order placed — the seller has been notified.');
    } else {
      toast.show(result.error ?? 'Could not place order.', 'rose');
    }
  }

  if (!session.loading && !session.authenticated) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon="🛍️"
          title={t('Campus Economy & Marketplace')}
          titleBn={t('Campus Economy & Marketplace')}
          blurb={t('Buy, sell and rent verified student items with monitored campus handover points.')}
        />
        <SignInPrompt moduleName="the marketplace" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🛍️"
        title="Campus Economy & Marketplace"
        titleBn="ক্যাম্পাস ইকোনমি ও মার্কেটপ্লেস"
        blurb={t('Buy, sell and rent verified student items with monitored campus handover points.')}
        live
        demo={listings.demo}
      >
        <Badge tone="emerald">{listings.total} listings</Badge>
        <Button onClick={() => setCreateOpen(true)}>+ Post a listing</Button>
      </ModuleHeader>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <Input
            placeholder="Search books, laptops, bicycles…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search marketplace listings"
          />
          <Select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            options={categories.map((category) => ({ value: category, label: category }))}
            placeholder="All categories"
            className="md:max-w-[220px]"
          />
        </div>
        <FilterChips
          label="Listing type"
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: 'SELL', label: 'For sale' },
            { value: 'RENT', label: 'For rent' },
            { value: 'EXCHANGE', label: 'Exchange' },
            { value: 'WANTED', label: 'Wanted' },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {listings.loading ? (
            <SkeletonList rows={3} />
          ) : listings.error ? (
            <EmptyState icon="⚠️" title={t('No listings found')} description={listings.error} action={<Button onClick={listings.refresh}>{t('Loading…')}</Button>} />
          ) : listings.data.length === 0 ? (
            <EmptyState
              icon="🛍️"
              title={t('No listings found')}
              description={t('Be the first to post in this category.')}
              action={<Button onClick={() => setCreateOpen(true)}>{t('New listing')}</Button>}
            />
          ) : (
            listings.data.map((listing) => {
              const seller = (listing.profiles ?? {}) as Row;
              const pickup = (listing.campus_pickup_points ?? {}) as Row;
              return (
                <Card key={String(listing.id)} className="p-4 hover:border-emerald-500/40 transition">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="emerald">{KIND_LABEL[String(listing.kind)] ?? listing.kind}</Badge>
                        <CampusBadge universityId={listing.university_id} />
                        <Badge tone={statusTone(listing.status)}>{String(listing.status)}</Badge>
                        {listing.condition && <Badge tone="slate">{String(listing.condition).replace('_', ' ')}</Badge>}
                      </div>
                      <h3 className="font-bold text-sm">{listing.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{listing.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <span>👤 {seller.full_name ?? 'Student seller'}</span>
                        {seller.trust_level && <span>✓ {seller.trust_level}</span>}
                        <span>🕒 {timeAgo(listing.created_at)}</span>
                        {pickup.name_en && <span>📦 {locale === 'bn' ? pickup.name_bn ?? pickup.name_en : pickup.name_en}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-2">
                      <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatBdt(listing.price_bdt)}
                        {listing.rent_period && <span className="text-[11px] font-medium text-slate-400"> {listing.rent_period}</span>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setActiveListing(listing)}>
                          {t('Contact')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setCheckoutListing(listing);
                            setPickupPointId(String(listing.pickup_point_id ?? ''));
                            setCheckoutOpen(true);
                          }}
                        >
                          {t('Reserve')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-2">
            <SectionHeader icon="📦" title={t('Campus pickup point')} subtitle={t('Campus pickup point')} />
            <ul className="space-y-2">
              {pickupPoints.data.map((point) => (
                <li key={String(point.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div className="font-semibold">{point.name_en}</div>
                  <div className="text-slate-400">{point.location_en}</div>
                </li>
              ))}
              {pickupPoints.data.length === 0 && (
                <li className="text-xs text-slate-400">
                  {t('No listings found')}
                </li>
              )}
            </ul>
          </Card>

          <Card className="p-4 space-y-2">
            <SectionHeader icon="🧾" title={t('My orders')} subtitle={t('My listings')} />
            {orders.data.length === 0 ? (
              <p className="text-xs text-slate-400">No orders yet. Reserve a listing to see live status here.</p>
            ) : (
              <ul className="space-y-2">
                {orders.data.map((order) => (
                  <li key={String(order.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px]">{order.order_code}</span>
                      <Badge tone={statusTone(order.status)}>{String(order.status)}</Badge>
                    </div>
                    <div className="text-slate-400">
                      {formatBdt(order.amount_bdt)} • {(order.campus_pickup_points as Row)?.name_en ?? 'Pickup point'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 text-xs space-y-1.5">
            <div className="font-bold text-sm">Safety first 🤝</div>
            <p className="text-slate-500 dark:text-slate-400">
              {t('Your data stays inside your university tenant.')}
              Campus360 so moderators can help if something goes wrong.
            </p>
            <Link href="/trust" className="text-emerald-500 font-semibold">
              Report a problem →
            </Link>
          </Card>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('New listing')} wide>
        <ModuleForm
          moduleKey="marketplace"
          options={{ pickup_point_id: pickupOptions }}
          omit={['status']}
          submitLabel="Publish listing"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={`${t('Reserve')}: ${checkoutListing?.title ?? ''}`}
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Safe handover at a monitored campus point.</span>
            <Button onClick={handlePlaceOrder} loading={submitting}>
              Confirm reservation
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label={t('Campus pickup point')} hint={t('Campus pickup point')}>
            <Select
              value={pickupPointId}
              onChange={(event) => setPickupPointId(event.target.value)}
              options={pickupOptions}
              placeholder={t('Campus pickup point')}
            />
          </Field>
          <Field label="Preferred handover window" hint="e.g. Today 5–7 PM, or after Friday prayer">
            <Input value={meetupWindow} onChange={(event) => setMeetupWindow(event.target.value)} />
          </Field>
          <Field label="Note for the seller">
            <Input value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder="I can bring exact change." />
          </Field>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300">
            Amount payable on handover: <strong>{formatBdt(checkoutListing?.price_bdt)}</strong>. Campus360 never holds
            {t('Your data stays inside your university tenant.')}
          </div>
        </div>
      </Modal>

      {activeListing && (
        <ListingChat listing={activeListing} onClose={() => setActiveListing(null)} />
      )}

      {toast.node}
    </div>
  );
}

function ListingChat({
  listing,
  onClose,
}: {
  listing: Row;
  onClose: () => void;
}) {
  const session = useSession();
  const { t } = useUi();
  const [draft, setDraft] = React.useState('');
  const messages = useRealtimeModuleList('marketplace-messages', {
    filters: { listing_id: String(listing.id) },
    limit: 100,
    enabled: !!session.authenticated,
  });
  const { create } = useModuleMutation('marketplace-messages');
  const [pending, setPending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data.length]);

  const visible = messages.data.filter(
    (message) =>
      String(message.sender_id) === String(session.userId) || String(message.recipient_id) === String(session.userId)
  );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setPending(true);
    const result = await create({
      listing_id: listing.id,
      recipient_id: listing.seller_id,
      body: draft.trim(),
    });
    setPending(false);
    if (result.ok) {
      setDraft('');
      messages.refresh();
    }
  }

  return (
    <Modal open onClose={onClose} title={`${t('Contact')} — ${listing.title}`}>
      <div className="space-y-3">
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {visible.length === 0 && (
            <p className="text-xs text-slate-400">
              Start the conversation. Messages update in real time with Supabase Realtime.
            </p>
          )}
          {visible.map((message) => {
            const mine = String(message.sender_id) === String(session.userId);
            return (
              <div
                key={String(message.id)}
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                  mine
                    ? 'ml-auto bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <p>{message.body}</p>
                <div className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {timeAgo(message.created_at)}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about condition, price or handover…"
            aria-label="Message"
          />
          <Button type="submit" loading={pending}>
            Send
          </Button>
        </form>
      </div>
    </Modal>
  );
}
