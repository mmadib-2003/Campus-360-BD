// apps/web/app/dining/page.tsx
'use client';

import React from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  ModuleHeader,
  SectionHeader,
  Select,
  SignInPrompt,
  SkeletonList,
  Stat,
  statusTone,
  useToast,
} from '@/components/modules/ui';
import { ModuleForm } from '@/components/modules/ModuleForm';
import { useModuleMutation, useRealtimeModuleList, useSession, Row } from '@/lib/modules/client';
import { formatBdt, toDateInputValue } from '@/lib/utils';
import { useUi } from '@/lib/i18n-client';
import { CampusBadge } from '@/components/CampusBadge';
import { asArray } from '@/lib/render-safe';

export default function DiningPage() {
  const session = useSession();
  const { t } = useUi();
  const [tab, setTab] = React.useState<'cafeteria' | 'homefood' | 'orders'>('cafeteria');
  const [meal, setMeal] = React.useState('ALL');
  const [preorderTarget, setPreorderTarget] = React.useState<{ menu: Row; item: Row } | null>(null);
  const [homeFoodTarget, setHomeFoodTarget] = React.useState<Row | null>(null);
  const [listFoodOpen, setListFoodOpen] = React.useState(false);
  const toast = useToast();

  const menus = useRealtimeModuleList('cafeteria-menus', {
    filters: { meal },
    limit: 40,
  });
  const homeFood = useRealtimeModuleList('home-food', { limit: 40, enabled: !!session.authenticated });
  const orders = useRealtimeModuleList('food-orders', { limit: 40, enabled: !!session.authenticated });
  const orderMutation = useModuleMutation('food-orders');
  const homeFoodMutation = useModuleMutation('home-food');
  const [pending, setPending] = React.useState(false);

  async function placeOrder(payload: Row) {
    setPending(true);
    const result = await orderMutation.create(payload);
    setPending(false);
    if (result.ok) {
      orders.refresh();
      setPreorderTarget(null);
      setHomeFoodTarget(null);
      toast.show('Order placed — collect it inside your pickup window.');
      return true;
    }
    toast.show(result.error ?? 'Could not place order.', 'rose');
    return false;
  }


  const todayOrders = asArray(orders.data).filter(
    (order) => new Date(String(order.created_at)).toDateString() === new Date().toDateString()
  );

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon="🍛"
        title="Smart Cafeteria & Home-Made Food"
        titleBn="স্মার্ট ক্যাফেটেরিয়া ও ঘরোয়া খাবার"
        blurb={t("Today's hall menu, mess seats and home-made food from verified students.")}
        live
        demo={menus.demo}
      >
        <Button onClick={() => setListFoodOpen(true)}>+ Sell home-made food</Button>
      </ModuleHeader>
      {/* Browsing is public now, so the sign-in path sits *below* the listings
          instead of replacing them: guests read, members post, book and chat. */}
      {!session.authenticated && <SignInPrompt moduleName="campus dining" />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Menus today" value={asArray(menus.data).length} />
        <Stat label="Home kitchens" value={asArray(homeFood.data).length} tone="teal" />
        <Stat label="My orders today" value={todayOrders.length} tone="amber" />
        <Stat
          label="Ready for pickup"
          value={asArray(orders.data).filter((order) => String(order.status) === 'READY').length}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'cafeteria', label: t('Dining') },
          { key: 'homefood', label: t('Dining') },
          { key: 'orders', label: `${t('My orders')} (${asArray(orders.data).length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
              tab === item.key
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'cafeteria' && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">Meal</span>
            {['ALL', 'BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMeal(value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                  meal === value
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                {value === 'ALL' ? t('All') : value}
              </button>
            ))}
          </Card>

          {menus.loading ? (
            <SkeletonList rows={2} />
          ) : asArray(menus.data).length === 0 ? (
            <EmptyState icon="🍽️" title={t('No listings found')} description={t('No listings found')} />
          ) : (
            <div className="space-y-3">
              {asArray(menus.data).map((menu) => {
                const items = ((menu.cafeteria_items as Row[]) ?? []).filter((item) => item.is_available !== false);
                return (
                  <Card key={String(menu.id)} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="orange">{String(menu.meal)}</Badge>
                      <CampusBadge universityId={menu.university_id} />
                      <Badge tone={statusTone(menu.is_active ? 'ACTIVE' : 'CLOSED')}>
                        {menu.is_active ? 'Open' : 'Closed'}
                      </Badge>
                      <span className="text-[11px] text-slate-400 ml-auto">
                        📅 {toDateInputValue(menu.serving_date)} • 🕐 {menu.pickup_window}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm">{menu.name_en}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map((item) => (
                        <div
                          key={String(item.id)}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{item.name_en}</div>
                            <div className="text-slate-400">
                              {formatBdt(item.price_bdt)}
                              {item.is_vegetarian && ' • Veg'}
                            </div>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => setPreorderTarget({ menu, item })}>
                            {t('Reserve')}
                          </Button>
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-xs text-slate-400">{t('No listings found')}</p>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'homefood' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {asArray(homeFood.data).length === 0 && (
            <EmptyState icon="🏠" title="No home kitchens listed" description="Student cooks can list home-made food with campus delivery." action={<Button onClick={() => setListFoodOpen(true)}>List your kitchen</Button>} />
          )}
          {asArray(homeFood.data).map((listing) => (
            <Card key={String(listing.id)} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="orange">{String(listing.cuisine)}</Badge>
                <Badge tone={statusTone(listing.status)}>{String(listing.status)}</Badge>
                {listing.delivery_available && <Badge tone="emerald">Campus delivery</Badge>}
              </div>
              <h3 className="font-bold text-sm">{listing.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{listing.description}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>🍲 {listing.portion}</span>
                <span>• 🕐 {listing.available_from}–{listing.available_to}</span>
                {listing.delivery_available && <span>• 🛵 +{formatBdt(listing.delivery_fee_bdt)}</span>}
                <span>• 👩‍🍳 {(listing.profiles as Row)?.full_name ?? 'Student cook'}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatBdt(listing.price_bdt)}</span>
                <Button size="sm" onClick={() => setHomeFoodTarget(listing)}>
                  Order now
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-2">
          <SectionHeader icon="🧾" title="My food orders" subtitle="Live status from kitchen to counter" />
          {asArray(orders.data).length === 0 ? (
            <EmptyState icon="🧾" title={t('My orders')} description={t('Reserve') + ' a cafeteria meal or a home-made dish.'} />
          ) : (
            asArray(orders.data).map((order) => (
              <Card key={String(order.id)} className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {order.item_name} × {order.quantity}
                  </div>
                  <div className="text-slate-400">
                    {order.order_code} • {formatBdt(order.total_bdt)} • {String(order.fulfilment).replace('_', ' ')}
                    {order.pickup_window ? ` • ${order.pickup_window}` : ''}
                  </div>
                </div>
                <Badge tone={statusTone(order.status)}>{String(order.status)}</Badge>
              </Card>
            ))
          )}
        </div>
      )}

      {preorderTarget && (
        <PreorderModal
          target={preorderTarget}
          pending={pending}
          onClose={() => setPreorderTarget(null)}
          onSubmit={(payload) =>
            placeOrder({
              source: 'CAFETERIA',
              menu_id: preorderTarget.menu.id,
              item_id: preorderTarget.item.id,
              item_name: preorderTarget.item.name_en,
              quantity: payload.quantity,
              total_bdt: Number(preorderTarget.item.price_bdt) * payload.quantity,
              pickup_window: preorderTarget.menu.pickup_window,
              fulfilment: 'PICKUP',
            })
          }
        />
      )}

      {homeFoodTarget && (
        <HomeFoodModal
          listing={homeFoodTarget}
          pending={pending}
          onClose={() => setHomeFoodTarget(null)}
          onSubmit={(payload) =>
            placeOrder({
              source: 'HOME_FOOD',
              food_listing_id: homeFoodTarget.id,
              item_name: homeFoodTarget.title,
              quantity: payload.quantity,
              total_bdt:
                Number(homeFoodTarget.price_bdt) * payload.quantity +
                (payload.fulfilment === 'CAMPUS_DELIVERY' ? Number(homeFoodTarget.delivery_fee_bdt ?? 0) : 0),
              fulfilment: payload.fulfilment,
              delivery_spot: payload.delivery_spot,
            })
          }
        />
      )}

      <Modal open={listFoodOpen} onClose={() => setListFoodOpen(false)} title="Sell home-made food" wide>
        <ModuleForm
          moduleKey="home-food"
          omit={['status']}
          submitLabel="Publish listing"
          onSubmit={async (values) => {
            const result = await homeFoodMutation.create(values);
            if (result.ok) {
              setListFoodOpen(false);
              homeFood.refresh();
              toast.show('Your kitchen is live on campus.');
              return { ok: true };
            }
            return { ok: false, error: result.error };
          }}
          onCancel={() => setListFoodOpen(false)}
        />
      </Modal>

      {toast.node}
    </div>
  );
}

function PreorderModal({
  target,
  pending,
  onClose,
  onSubmit,
}: {
  target: { menu: Row; item: Row };
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { quantity: number }) => Promise<boolean>;
}) {
  const { t } = useUi();
  const [quantity, setQuantity] = React.useState(1);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${t('Reserve')} — ${target.item.name_en}`}
      footer={
        <Button loading={pending} onClick={() => onSubmit({ quantity })}>
          Confirm pre-order ({formatBdt(Number(target.item.price_bdt) * quantity)})
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {target.menu.name_en} • Pickup window {target.menu.pickup_window}
        </div>
        <Field label="Quantity">
          <Input type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
        </Field>
        <p className="text-[11px] text-slate-400">
          Pay at the counter when you collect — pre-ordering reserves your plate so you skip the queue.
        </p>
      </div>
    </Modal>
  );
}

function HomeFoodModal({
  listing,
  pending,
  onClose,
  onSubmit,
}: {
  listing: Row;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { quantity: number; fulfilment: string; delivery_spot?: string }) => Promise<boolean>;
}) {
  const { t } = useUi();
  const [quantity, setQuantity] = React.useState(1);
  const [fulfilment, setFulfilment] = React.useState(listing.delivery_available ? 'CAMPUS_DELIVERY' : 'PICKUP');
  const [spot, setSpot] = React.useState('');
  const total =
    Number(listing.price_bdt) * quantity + (fulfilment === 'CAMPUS_DELIVERY' ? Number(listing.delivery_fee_bdt ?? 0) : 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Order — ${listing.title}`}
      footer={
        <Button loading={pending} onClick={() => onSubmit({ quantity, fulfilment, delivery_spot: spot })}>
          Place order ({formatBdt(total)})
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Quantity">
          <Input type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
        </Field>
        <Field label="How do you want it?">
          <Select
            value={fulfilment}
            onChange={(event) => setFulfilment(event.target.value)}
            options={[
              { value: 'PICKUP', label: 'Pick up from the cook' },
              ...(listing.delivery_available
                ? [{ value: 'CAMPUS_DELIVERY', label: `Campus delivery (+${formatBdt(listing.delivery_fee_bdt)})` }]
                : []),
            ]}
          />
        </Field>
        {fulfilment === 'CAMPUS_DELIVERY' && (
          <Field label="Delivery spot" hint="e.g. Kamaluddin Hall gate, TSC canteen">
            <Input value={spot} onChange={(event) => setSpot(event.target.value)} placeholder="A. F. M. Kamaluddin Hall gate" />
          </Field>
        )}
      </div>
    </Modal>
  );
}
