'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuildingIcon } from '@/components/icons/BuildingIcon'
import { CalendarIcon } from '@/components/icons/CalendarIcon'
import { CheckCircleIcon } from '@/components/icons/CheckCircleIcon'
import { ChevronRightIcon } from '@/components/icons/ChevronRightIcon'
import { FilterIcon } from '@/components/icons/FilterIcon'
import { MapPinIcon } from '@/components/icons/MapPinIcon'
import { SearchIcon } from '@/components/icons/SearchIcon'
import { UserIcon } from '@/components/icons/UserIcon'
import { Button } from '@/components/ui/button'
import { getI18nText } from '@/lib/i18n/get-text'
import { cn } from '@/lib/utils'
import type { HubMarketplace } from '@/lib/marketplace/get-marketplace'
import type {
  BookingDispatchResult,
  CartItemInput,
  GuidedSearchParams,
  MarketplaceListingOffer,
  SearchPresetRow,
} from '@/types/marketplace-guided-search'
import type { DispatchTargetResult } from '@/types/marketplace-request'
import { MarketplaceMyRequests } from '@/components/marketplace/marketplace-my-requests'
import { useMarketplaceLocale } from '@/components/marketplace/marketplace-locale-context'

const vitrinaBase =
  process.env.NEXT_PUBLIC_VITRINA_PUBLIC?.replace(/\/$/, '') ??
  'https://vitrina.yanbada.com'

type Step =
  | 'preset'
  | 'city'
  | 'text'
  | 'summary'
  | 'clarify'
  | 'results'
  | 'booked'
  | 'request_form'
  | 'requested'

type HubView = 'search' | 'requests'

type MarketplaceGuidedSearchProps = {
  marketplace: HubMarketplace
}

function emptyParams(): GuidedSearchParams {
  return {
    city: null,
    date_from: null,
    date_to: null,
    people: null,
    notes: null,
    search: {
      keywords: null,
      categories: [],
      tags: [],
      country: null,
      city: null,
      marketplace: null,
    },
  }
}

function buildCompanyUrl(tenantSlug: string): string {
  return `${vitrinaBase}/h/${tenantSlug}?embed=1`
}

function buildListingUrl(tenantSlug: string, pageSlug: string): string {
  return `${vitrinaBase}/p/${pageSlug}?tenant=${tenantSlug}`
}

function formatPrice(offer: MarketplaceListingOffer): string | null {
  if (offer.price_from == null) return null
  const currency = offer.price_currency ?? 'KZT'
  return `от ${offer.price_from.toLocaleString('ru-RU')} ${currency}`
}

export function MarketplaceGuidedSearch({ marketplace }: MarketplaceGuidedSearchProps) {
  const { locale } = useMarketplaceLocale()
  const [step, setStep] = useState<Step>('preset')
  const [presets, setPresets] = useState<SearchPresetRow[]>([])
  const [preset, setPreset] = useState<SearchPresetRow | null>(null)
  const [queryText, setQueryText] = useState('')
  const [params, setParams] = useState<GuidedSearchParams>(emptyParams())
  const [missingParams, setMissingParams] = useState<string[]>([])
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<MarketplaceListingOffer[]>([])
  const [cart, setCart] = useState<CartItemInput[]>([])
  const [sort, setSort] = useState<'price_asc' | 'price_desc' | 'availability'>('availability')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookResults, setBookResults] = useState<BookingDispatchResult[]>([])
  const [hubView, setHubView] = useState<HubView>('search')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState('KZT')
  const [requestMessage, setRequestMessage] = useState('')
  const [requestResults, setRequestResults] = useState<DispatchTargetResult[]>([])

  const loadPresets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace.slug}/presets`)
      const json = (await res.json()) as { error?: string; presets?: SearchPresetRow[] }
      if (!res.ok) {
        setError(json.error ?? 'Не удалось загрузить пресеты')
        return
      }
      setPresets(json.presets ?? [])
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }, [marketplace.slug])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  const needsCityStep = useMemo(
    () => preset?.required_params.includes('city') ?? false,
    [preset]
  )

  function selectPreset(p: SearchPresetRow) {
    setPreset(p)
    setQueryText('')
    setParams(emptyParams())
    setMissingParams([])
    setClarifyAnswers({})
    setResults([])
    setCart([])
    setBookResults([])
    setStep(p.required_params.includes('city') ? 'city' : 'text')
  }

  async function runParse(nextParams?: Partial<GuidedSearchParams>) {
    if (!preset) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace.slug}/search/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset_id: preset.id,
          query: queryText,
          known_city: params.city,
          params: nextParams,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        params?: GuidedSearchParams
        missing_params?: string[]
      }
      if (!res.ok) {
        setError(json.error ?? 'Ошибка разбора')
        return
      }
      const parsed = json.params ?? emptyParams()
      setParams(parsed)
      setMissingParams(json.missing_params ?? [])
      setStep(json.missing_params?.length ? 'clarify' : 'summary')
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  function applyClarifyAndContinue() {
    const patch: Partial<GuidedSearchParams> = {}
    if (missingParams.includes('city') && clarifyAnswers.city) {
      patch.city = clarifyAnswers.city
      patch.search = { ...params.search, city: clarifyAnswers.city }
    }
    if (missingParams.includes('dates') && clarifyAnswers.dates) {
      patch.date_from = clarifyAnswers.dates
      patch.date_to = clarifyAnswers.dates
    }
    if (missingParams.includes('people') && clarifyAnswers.people) {
      const n = Number(clarifyAnswers.people)
      if (Number.isFinite(n) && n > 0) patch.people = n
    }
    const merged = { ...params, ...patch, search: { ...params.search, ...(patch.search ?? {}) } }
    setParams(merged)
    setStep('summary')
  }

  async function loadResults() {
    if (!preset) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace.slug}/search/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset_id: preset.id,
          params,
          sort,
          availability_filter: availabilityFilter,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        results?: MarketplaceListingOffer[]
      }
      if (!res.ok) {
        setError(json.error ?? 'Ошибка поиска')
        return
      }
      setResults(json.results ?? [])
      setStep('results')
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  function toggleCartItem(offer: MarketplaceListingOffer) {
    const exists = cart.find((c) => c.listing_id === offer.id)
    if (exists) {
      setCart(cart.filter((c) => c.listing_id !== offer.id))
      return
    }
    const titleText = getI18nText(offer.title, locale, offer.page_slug)
    setCart([
      ...cart,
      {
        listing_id: offer.id,
        tenant_slug: offer.tenant_slug ?? '',
        page_slug: offer.page_slug,
        title: titleText,
        date_from: params.date_from,
        date_to: params.date_to,
        people: params.people,
      },
    ])
  }

  async function bookAll() {
    if (!cart.length) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace.slug}/search/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params, items: cart }),
      })
      const json = (await res.json()) as {
        error?: string
        results?: BookingDispatchResult[]
      }
      if (!res.ok) {
        setError(json.error ?? 'Ошибка бронирования')
        return
      }
      setBookResults(json.results ?? [])
      setStep('booked')
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  function openRequestForm() {
    setRequestMessage(queryText || params.notes || '')
    setStep('request_form')
  }

  async function sendRequestToTargets() {
    const amount = Number(budgetAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Укажите корректный бюджет')
      return
    }
    const text = requestMessage.trim()
    if (!text) {
      setError('Укажите текст запроса')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketplace/${marketplace.slug}/search/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: { ...params, notes: text },
          request_text: text,
          budget_amount: amount,
          budget_currency: budgetCurrency,
          offers: results,
          target_limit: 10,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        dispatch_results?: DispatchTargetResult[]
      }
      if (!res.ok) {
        setError(json.error ?? 'Ошибка отправки запроса')
        return
      }
      setRequestResults(json.dispatch_results ?? [])
      setStep('requested')
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 md:px-6 md:pb-14">
      <div className="mb-8 flex gap-2">
        <Button
          size="sm"
          variant={hubView === 'search' ? 'default' : 'outline'}
          onClick={() => setHubView('search')}
        >
          Поиск
        </Button>
        <Button
          size="sm"
          variant={hubView === 'requests' ? 'default' : 'outline'}
          onClick={() => setHubView('requests')}
        >
          Мои запросы
        </Button>
      </div>

      {hubView === 'requests' ? (
        <MarketplaceMyRequests marketplaceSlug={marketplace.slug} />
      ) : null}

      {hubView === 'search' ? (
        <>

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === 'preset' ? (
        <section>
          <h2 className="mb-4 text-lg font-medium">Что ищете?</h2>
          {loading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-[var(--accent)] hover:shadow-md"
                onClick={() => selectPreset(p)}
              >
                <p className="font-medium text-foreground">{getI18nText(p.name, locale, p.theme_slug)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{p.theme_slug}</p>
                <ChevronRightIcon size={16} className="mt-3 text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'city' && preset ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Город</h2>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Например, Алматы"
            value={params.city ?? ''}
            onChange={(e) =>
              setParams({
                ...params,
                city: e.target.value,
                search: { ...params.search, city: e.target.value },
              })
            }
          />
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!params.city?.trim()}
              onClick={() => setStep('text')}
            >
              Далее
            </Button>
            <Button variant="ghost" onClick={() => setStep('preset')}>
              Назад
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'text' && preset ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Опишите запрос</h2>
          <textarea
            className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={getI18nText(preset.hint_template, locale)}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <div className="mt-4 flex gap-2">
            <Button disabled={!queryText.trim() || loading} onClick={() => {
              void runParse()
            }}>
              <SearchIcon size={16} className="mr-2" />
              Разобрать запрос
            </Button>
            <Button variant="ghost" onClick={() => setStep(needsCityStep ? 'city' : 'preset')}>
              Назад
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'clarify' && preset ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Уточните детали</h2>
          <div className="space-y-4">
            {missingParams.map((key) => {
              const hint = preset.clarify_hints[key]
              const label = hint ? getI18nText(hint, locale, key) : key
              return (
                <label key={key} className="block text-sm">
                  <span className="text-[var(--muted)]">{label}</span>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={clarifyAnswers[key] ?? ''}
                    onChange={(e) =>
                      setClarifyAnswers({ ...clarifyAnswers, [key]: e.target.value })
                    }
                  />
                </label>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={applyClarifyAndContinue}>Продолжить</Button>
            <Button variant="ghost" onClick={() => setStep('text')}>
              Назад
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'summary' ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">AI понял так</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {params.city ? (
              <div className="flex items-start gap-2">
                <MapPinIcon size={16} className="mt-0.5 text-[var(--muted)]" />
                <div>
                  <dt className="text-[var(--muted)]">Город</dt>
                  <dd>{params.city}</dd>
                </div>
              </div>
            ) : null}
            {params.date_from ? (
              <div className="flex items-start gap-2">
                <CalendarIcon size={16} className="mt-0.5 text-[var(--muted)]" />
                <div>
                  <dt className="text-[var(--muted)]">Даты</dt>
                  <dd>
                    {params.date_from}
                    {params.date_to && params.date_to !== params.date_from
                      ? ` — ${params.date_to}`
                      : ''}
                  </dd>
                </div>
              </div>
            ) : null}
            {params.people ? (
              <div className="flex items-start gap-2">
                <UserIcon size={16} className="mt-0.5 text-[var(--muted)]" />
                <div>
                  <dt className="text-[var(--muted)]">Люди</dt>
                  <dd>{params.people}</dd>
                </div>
              </div>
            ) : null}
            {params.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-[var(--muted)]">Заметки</dt>
                <dd>{params.notes}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4 flex gap-2">
            <Button disabled={loading} onClick={() => void loadResults()}>
              Показать предложения
            </Button>
            <Button variant="ghost" onClick={() => setStep('text')}>
              Изменить текст
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'results' ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <FilterIcon size={16} />
              Сортировка
            </div>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as 'price_asc' | 'price_desc' | 'availability')
              }
            >
              <option value="availability">Сначала доступные</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
            </select>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={availabilityFilter}
              onChange={(e) =>
                setAvailabilityFilter(
                  e.target.value as 'all' | 'available' | 'unavailable'
                )
              }
            >
              <option value="all">Все</option>
              <option value="available">Только доступные</option>
              <option value="unavailable">Недоступные</option>
            </select>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void loadResults()}>
              Обновить
            </Button>
          </div>

          {cart.length > 0 ? (
            <div className="mb-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
              <p className="text-sm font-medium">
                В брони: {cart.length} {cart.length === 1 ? 'позиция' : 'позиций'}
              </p>
              <Button
                className="mt-2"
                size="sm"
                disabled={loading}
                onClick={() => void bookAll()}
              >
                Забронировать всё
              </Button>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-[var(--muted)]">
                Или отправьте запрос всем подходящим исполнителям с указанием бюджета
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={openRequestForm}
              >
                Отправить запрос
              </Button>
            </div>
          ) : null}

          <ul className="space-y-4">
            {results.map((offer) => {
              const titleText = getI18nText(offer.title, locale, offer.page_slug)
              const inCart = cart.some((c) => c.listing_id === offer.id)
              const price = formatPrice(offer)
              const unavailable = offer.availability_checked && offer.available === false

              return (
                <li
                  key={offer.id}
                  className={cn(
                    'rounded-2xl border bg-card p-5 shadow-sm',
                    unavailable ? 'border-border opacity-80' : 'border-border'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {offer.logo_url ? (
                        <Image
                          src={offer.logo_url}
                          alt=""
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                          <BuildingIcon size={20} className="text-[var(--muted)]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{titleText}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {offer.tenant_name ?? offer.tenant_slug}
                        </p>
                        {price ? (
                          <p className="mt-1 text-sm font-medium text-foreground">{price}</p>
                        ) : null}
                        {unavailable ? (
                          <p className="mt-1 text-xs text-destructive">Нет мест на выбранные даты</p>
                        ) : offer.availability_checked && offer.available ? (
                          <p className="mt-1 text-xs text-[var(--accent)]">Доступно на даты</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {offer.tenant_slug ? (
                        <a
                          href={buildCompanyUrl(offer.tenant_slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                        >
                          Профиль
                        </a>
                      ) : null}
                      {offer.tenant_slug ? (
                        <a
                          href={buildListingUrl(offer.tenant_slug, offer.page_slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                        >
                          Страница
                        </a>
                      ) : null}
                      <Button
                        size="sm"
                        variant={inCart ? 'secondary' : 'default'}
                        disabled={!offer.tenant_slug}
                        onClick={() => toggleCartItem(offer)}
                      >
                        {inCart ? 'Убрать' : 'В бронь'}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {!results.length ? (
            <p className="text-sm text-[var(--muted)]">Предложений не найдено</p>
          ) : null}

          <div className="mt-6">
            <Button variant="ghost" onClick={() => setStep('summary')}>
              Назад к параметрам
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'booked' ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircleIcon size={20} className="text-[var(--accent)]" />
            <h2 className="text-lg font-medium">Результаты бронирования</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {bookResults.map((r) => (
              <li key={r.listing_id} className="rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{r.page_slug}</span>
                {' — '}
                {r.ok ? (
                  <span className="text-[var(--accent)]">
                    отправлено{r.submission_id ? ` (${r.submission_id.slice(0, 8)}…)` : ''}
                  </span>
                ) : (
                  <span className="text-destructive">{r.error ?? 'ошибка'}</span>
                )}
              </li>
            ))}
          </ul>
          <Button className="mt-4" onClick={() => setStep('preset')}>
            Новый поиск
          </Button>
        </section>
      ) : null}

      {step === 'request_form' ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Запрос исполнителям</h2>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="text-[var(--muted)]">Сообщение</span>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Бюджет</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-40 rounded-md border bg-background px-3 py-2 text-sm"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Валюта</span>
                <select
                  className="mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                  value={budgetCurrency}
                  onChange={(e) => setBudgetCurrency(e.target.value)}
                >
                  <option value="KZT">KZT</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Будет отправлено уникальным исполнителям из выдачи ({results.length} предложений)
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button disabled={loading} onClick={() => void sendRequestToTargets()}>
              Отправить запрос
            </Button>
            <Button variant="ghost" onClick={() => setStep('results')}>
              Назад
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'requested' ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircleIcon size={20} className="text-[var(--accent)]" />
            <h2 className="text-lg font-medium">Запрос отправлен</h2>
          </div>
          <ul className="space-y-2 text-sm">
            {requestResults.map((r) => (
              <li key={r.target_id} className="rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{r.tenant_slug ?? r.tenant_id}</span>
                {' — '}
                {r.ok ? (
                  <span className="text-[var(--accent)]">отправлено</span>
                ) : (
                  <span className="text-destructive">{r.error ?? 'ошибка'}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => { setHubView('requests'); setStep('preset') }}>
              Мои запросы
            </Button>
            <Button variant="ghost" onClick={() => setStep('preset')}>
              Новый поиск
            </Button>
          </div>
        </section>
      ) : null}
        </>
      ) : null}
    </div>
  )
}
