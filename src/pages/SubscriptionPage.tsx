import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Check, CreditCard, GraduationCap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageShell } from '@/components/layout/PageShell'
import { SubscriptionLegal } from '@/components/billing/SubscriptionLegal'
import { PageHeader } from '@/components/common/PageHeader'
import { BackBarButton } from '@/components/layout/MobileNavBar'
import { Button } from '@/components/ui/button'
import { InsetGroup, InsetRow, SegmentedControl } from '@/components/ui/inset-list'
import { Panel } from '@/components/ui/card'
import { useEntitlement } from '@/hooks/useEntitlement'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSubscription } from '@/hooks/useSubscription'
import {
  BillingUnavailableError,
  getProducts,
  isPurchaseSurface,
  openManageSubscriptions,
  purchase,
  restorePurchases,
  type StoreProduct,
} from '@/lib/billing/store'
import {
  PLANS,
  monthlyEquivalent,
  yearlySavingPercent,
  type BillingPeriod,
  type Plan,
} from '@/lib/billing/plans'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

const PERIODS: { value: BillingPeriod; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

/**
 * The paywall: what Retrn sells, and the place it is bought.
 *
 * Built to pass App Store review before there is a store behind it. Guideline
 * 3.1.2 requires an auto-renewable subscription to state, in the app, the
 * title of the subscription, its length, its price per period, and to carry
 * working links to the terms (EULA) and the privacy policy — plus a Restore
 * Purchases control that works on a fresh install. All of that is here and
 * visible whether or not a store is connected.
 *
 * Until `setBillingProvider()` is called with a real StoreKit adapter (see
 * src/lib/billing/store.ts), the buy buttons say so plainly rather than
 * offering an action that cannot complete — and, deliberately, they never
 * link out to a website to pay, which is what Guideline 3.1.1 forbids.
 */
export function SubscriptionPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { plan: currentPlan, isPro, edu, label } = useEntitlement()
  const { subscription, canPurchase } = useSubscription()

  const [period, setPeriod] = React.useState<BillingPeriod>('yearly')
  const [products, setProducts] = React.useState<StoreProduct[]>([])
  const [busyProductId, setBusyProductId] = React.useState<string | null>(null)
  const [restoring, setRestoring] = React.useState(false)

  // The store's own localized prices, when a store is connected. Without one
  // this resolves to an empty list and the catalogue's strings are shown.
  React.useEffect(() => {
    let alive = true
    void getProducts().then((list) => {
      if (alive) setProducts(list)
    })
    return () => {
      alive = false
    }
  }, [])

  const priceFor = React.useCallback(
    (productId: string | null, fallback: string) =>
      products.find((p) => p.productId === productId)?.price ?? fallback,
    [products],
  )

  async function handlePurchase(productId: string) {
    tapFeedback()
    setBusyProductId(productId)
    try {
      await purchase(productId)
      successFeedback()
      toast.success('You’re subscribed. Everything is unlocked.')
    } catch (err) {
      if (err instanceof BillingUnavailableError) {
        toast.info('Subscriptions open when Retrn lands on the App Store.')
      } else if (!isCancellation(err)) {
        errorFeedback()
        toast.error(err instanceof Error ? err.message : 'That purchase didn’t go through.')
      }
    } finally {
      setBusyProductId(null)
    }
  }

  async function handleRestore() {
    tapFeedback()
    setRestoring(true)
    try {
      const state = await restorePurchases()
      if (state.active) {
        successFeedback()
        toast.success('Subscription restored.')
      } else {
        toast.info('No previous purchase found for this Apple ID.')
      }
    } catch (err) {
      if (err instanceof BillingUnavailableError) {
        toast.info('Nothing to restore yet — purchases open at launch.')
      } else {
        errorFeedback()
        toast.error('Couldn’t reach the App Store. Try again in a moment.')
      }
    } finally {
      setRestoring(false)
    }
  }

  const header = (
    <PageHeader
      title="Subscription"
      description="Everything Retrn can do, and what each plan costs."
    />
  )

  // A laptop gets a pricing page, not the phone's stacked cards: every tier
  // side by side so they can be compared at a glance.
  if (!isMobile) {
    return (
      <PageShell header={header}>
        <DesktopSubscription
          currentPlan={currentPlan}
          label={label}
          isPro={isPro}
          eduVerified={edu.verified}
          expiresAt={subscription.expiresAt}
          inTrial={subscription.inTrial}
          canPurchase={canPurchase}
          priceFor={priceFor}
          busyProductId={busyProductId}
          onPurchase={(id) => void handlePurchase(id)}
          onVerifyEdu={() => navigate(ROUTES.settings)}
        />
      </PageShell>
    )
  }

  return (
    <PageShell
      mobile={{ title: 'Subscription', largeTitle: false, leading: <BackBarButton label="More" /> }}
      bodyClassName="bg-grouped"
      header={header}
    >
      <div className="space-y-6 pb-2">
        <CurrentPlanCard
          label={label}
          isPro={isPro}
          eduVerified={edu.verified}
          expiresAt={subscription.expiresAt}
          inTrial={subscription.inTrial}
        />

        {!isPro && (
          <>
            <div className="px-1">
              <SegmentedControl
                label="Billing period"
                value={period}
                onChange={setPeriod}
                options={PERIODS}
              />
            </div>

            <div className="space-y-4">
              {PLANS.filter((p) => p.prices).map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  period={period}
                  current={p.id === currentPlan}
                  price={priceFor(
                    p.prices![period].appStoreProductId,
                    p.prices![period].display,
                  )}
                  busy={busyProductId === p.prices![period].appStoreProductId}
                  disabled={busyProductId !== null || !canPurchase}
                  canPurchase={canPurchase}
                  onPurchase={() => void handlePurchase(p.prices![period].appStoreProductId!)}
                />
              ))}
            </div>
          </>
        )}

        {!edu.verified && (
          <InsetGroup footer="A verified @babson.edu address unlocks every paid feature at no charge — no card, no subscription.">
            <InsetRow
              leading={<GraduationCap className="h-[22px] w-[22px] text-muted-foreground" strokeWidth={1.9} />}
              title="Babson student?"
              subtitle="Verify your school email instead"
              last
              onClick={() => {
                tapFeedback()
                navigate(ROUTES.settings)
              }}
            />
          </InsetGroup>
        )}

        <InsetGroup>
          <InsetRow
            title="Restore Purchases"
            subtitle="Already subscribed on another device?"
            chevron={false}
            disabled={restoring}
            accessory={restoring ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : undefined}
            onClick={() => void handleRestore()}
          />
          {subscription.active && (
            <InsetRow
              title="Manage Subscription"
              subtitle="Change plan or cancel in the App Store"
              chevron={false}
              onClick={() => void openManageSubscriptions()}
            />
          )}
          <InsetRow
            title="Terms of Use"
            onClick={() => navigate(ROUTES.terms)}
          />
          <InsetRow
            title="Privacy Policy"
            last
            onClick={() => navigate(ROUTES.privacy)}
          />
        </InsetGroup>

        <SubscriptionLegal className="px-4" />
      </div>
    </PageShell>
  )
}

/**
 * The web paywall. Purchases only happen in the iPhone app (App Store rules
 * forbid pointing to a web checkout from it, and there's no web billing), so
 * this is a comparison page: what you're on, what each tier adds, and where
 * to go to buy it.
 */
function DesktopSubscription({
  currentPlan,
  label,
  isPro,
  eduVerified,
  expiresAt,
  inTrial,
  canPurchase,
  priceFor,
  busyProductId,
  onPurchase,
  onVerifyEdu,
}: {
  currentPlan: string
  label: string
  isPro: boolean
  eduVerified: boolean
  expiresAt: string | null
  inTrial: boolean
  canPurchase: boolean
  priceFor: (productId: string | null, fallback: string) => string
  busyProductId: string | null
  onPurchase: (productId: string) => void
  onVerifyEdu: () => void
}) {
  const [period, setPeriod] = React.useState<BillingPeriod>('yearly')
  const saving = yearlySavingPercent(PLANS.find((p) => p.prices)!)

  return (
    <div className="space-y-6">
      <Panel className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isPro ? 'bg-brand/10 text-brand' : 'bg-foreground/[0.06] text-text-secondary',
            )}
          >
            {isPro ? <BadgeCheck className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Your plan</p>
            <p className="text-base font-semibold">{label}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {eduVerified
            ? 'Every paid feature, free, through the Babson offer.'
            : isPro
              ? renewalLine(expiresAt, inTrial)
              : 'Up to 30 contacts and the basics. Upgrade for the rest.'}
        </p>
      </Panel>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Plans</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {canPurchase
              ? 'Pick a plan to subscribe.'
              : 'Subscriptions are bought in the Retrn iPhone app and unlock everything here too.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && saving > 0 && (
            <span className="text-xs text-muted-foreground">Save {saving}% yearly</span>
          )}
          <div
            className="flex h-8 items-center rounded-md border bg-background p-0.5"
            role="group"
            aria-label="Billing period"
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                aria-pressed={period === p.value}
                className={cn(
                  'h-full rounded-sm px-3 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  period === p.value
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-3">
        {PLANS.map((plan) => {
          const detail = plan.prices?.[period]
          const productId = detail?.appStoreProductId ?? null
          const price = detail ? priceFor(productId, detail.display) : '$0'
          const current = plan.id === currentPlan
          return (
            <div key={plan.id} className="flex flex-col bg-background p-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{plan.name}</h3>
                {current ? (
                  <span className="rounded-sm bg-brand/10 px-1.5 py-px text-xs font-medium text-brand">
                    Current
                  </span>
                ) : (
                  plan.badge && (
                    <span className="rounded-sm border px-1.5 py-px text-xs font-medium text-text-secondary">
                      {plan.badge}
                    </span>
                  )
                )}
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="tnum text-3xl font-semibold tracking-[-0.02em]">{price}</span>
                <span className="text-sm text-muted-foreground">
                  {detail ? (period === 'yearly' ? '/yr' : '/mo') : 'forever'}
                </span>
              </div>
              <div className="mt-1 h-4 text-xs text-muted-foreground">
                {detail ? (monthlyEquivalent(detail) ?? 'Billed monthly, auto-renewing') : ''}
              </div>

              <p className="mt-3 min-h-[2.5rem] text-sm leading-snug text-text-secondary">
                {plan.tagline}
              </p>

              {productId && canPurchase ? (
                <Button
                  variant={plan.badge ? 'default' : 'outline'}
                  className="mt-5 w-full"
                  disabled={current || busyProductId !== null}
                  onClick={() => onPurchase(productId)}
                >
                  {busyProductId === productId && <Loader2 className="animate-spin" />}
                  {current ? 'Your current plan' : `Subscribe · ${price}`}
                </Button>
              ) : (
                <Button variant="outline" className="mt-5 w-full" disabled>
                  {current ? 'Your current plan' : detail ? 'Subscribe in the iPhone app' : 'Included'}
                </Button>
              )}

              <ul className="mt-6 space-y-2 border-t pt-5">
                {plan.featuresLead && (
                  <li className="text-xs font-medium text-text-secondary">{plan.featuresLead}</li>
                )}
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm leading-snug text-text-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {!eduVerified && (
        <Panel className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Babson student?</p>
              <p className="text-muted-foreground">
                A verified @babson.edu address unlocks every paid feature at no charge — no card,
                no subscription.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onVerifyEdu}>
            Verify school email
          </Button>
        </Panel>
      )}

      <SubscriptionLegal className="max-w-3xl text-xs" />
    </div>
  )
}

/** What this account is on today, before any of it is for sale. */
function CurrentPlanCard({
  label,
  isPro,
  eduVerified,
  expiresAt,
  inTrial,
}: {
  label: string
  isPro: boolean
  eduVerified: boolean
  expiresAt: string | null
  inTrial: boolean
}) {
  return (
    <div className="rounded-[14px] bg-grouped-cell p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            isPro ? 'bg-brand/10 text-brand' : 'bg-foreground/[0.06] text-text-secondary',
          )}
        >
          {isPro ? (
            <BadgeCheck className="h-[22px] w-[22px]" strokeWidth={1.9} />
          ) : (
            <CreditCard className="h-[22px] w-[22px]" strokeWidth={1.9} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ios-footnote text-muted-foreground">Your plan</p>
          <p className="text-ios-title3 mt-0.5">{label}</p>
          <p className="text-ios-footnote mt-1 text-muted-foreground">
            {eduVerified
              ? 'Every paid feature, free, through the Babson offer.'
              : isPro
                ? renewalLine(expiresAt, inTrial)
                : 'Up to 30 contacts and the basics. Upgrade for the rest.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function renewalLine(expiresAt: string | null, inTrial: boolean): string {
  if (!expiresAt) return inTrial ? 'Free trial in progress.' : 'Active — renews automatically.'
  const when = new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return inTrial ? `Free trial — billing starts ${when}.` : `Renews automatically on ${when}.`
}

/** One purchasable tier: title, length, price per period, and what it unlocks. */
function PlanCard({
  plan,
  period,
  price,
  current,
  busy,
  disabled,
  canPurchase,
  onPurchase,
}: {
  plan: Plan
  period: BillingPeriod
  price: string
  current: boolean
  busy: boolean
  disabled: boolean
  canPurchase: boolean
  onPurchase: () => void
}) {
  const detail = plan.prices![period]
  const saving = period === 'yearly' ? yearlySavingPercent(plan) : null
  const equivalent = monthlyEquivalent(detail)

  return (
    <section className="rounded-[14px] bg-grouped-cell p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-ios-headline">{plan.name}</h2>
        {plan.badge && (
          <span className="text-ios-caption rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
            {plan.badge}
          </span>
        )}
      </div>

      <p className="text-ios-footnote mt-1 text-muted-foreground">{plan.tagline}</p>

      {/* Price and length, stated together — App Store review looks for both. */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tnum text-[28px] font-semibold tracking-[-0.02em]">{price}</span>
        <span className="text-ios-subhead text-muted-foreground">
          {period === 'yearly' ? 'per year' : 'per month'}
        </span>
      </div>
      <p className="text-ios-caption mt-0.5 h-4 text-muted-foreground">
        {equivalent ?? `${plan.name} · 1 month, auto-renewing`}
        {saving && saving > 0 ? ` · save ${saving}%` : ''}
      </p>

      <Button
        size="lg"
        variant={plan.badge ? 'default' : 'outline'}
        className="mt-4 h-11 w-full rounded-[12px] text-[17px]"
        disabled={disabled || current}
        onClick={onPurchase}
      >
        {busy && <Loader2 className="animate-spin" />}
        {current ? 'Your current plan' : canPurchase ? `Subscribe · ${price}` : 'Available at launch'}
      </Button>

      {!canPurchase && (
        <p className="text-ios-caption mt-2 text-center text-muted-foreground">
          {isPurchaseSurface()
            ? 'In-app purchases open when Retrn is live on the App Store.'
            : 'Subscriptions are purchased in the Retrn iPhone app.'}
        </p>
      )}

      <ul className="mt-4 space-y-2 border-t border-border/60 pt-3.5">
        {plan.featuresLead && (
          <li className="text-ios-caption font-medium text-text-secondary">{plan.featuresLead}</li>
        )}
        {plan.features.map((f) => (
          <li key={f} className="text-ios-footnote flex items-start gap-2 text-text-secondary">
            <Check className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2.4} />
            {f}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A purchase the person backed out of isn't an error worth shouting about. */
function isCancellation(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  return message.includes('cancel') || message.includes('user_cancelled')
}
