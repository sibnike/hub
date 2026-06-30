'use client'

import { useState } from 'react'
import { HandshakeIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const ACCESS_TOKEN_STORAGE_KEY = 'yanbada.marketplace.request_access_token'

type RequestSuccess = {
  request_id: string
  access_token: string
  matched_count: number
  dispatched_count: number
  message: string
}

export function MarketplaceRequestForm() {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<RequestSuccess | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedContact = contact.trim()
    const trimmedText = text.trim()

    if (!trimmedName || !trimmedContact || !trimmedText) {
      setError('Заполните имя, контакт и описание запроса')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/marketplace/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_name: trimmedName,
          requester_contact: trimmedContact,
          request_text: trimmedText,
        }),
      })

      const json = (await res.json()) as RequestSuccess & { error?: string }

      if (!res.ok) {
        throw new Error(json.error ?? 'Не удалось отправить запрос')
      }

      if (json.access_token) {
        sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, json.access_token)
      }

      setSuccess(json)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить запрос')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Запрос отправлен</h2>
        <p className="mt-2 text-sm text-muted-foreground">{success.message}</p>
        {success.dispatched_count > 0 ? (
          <p className="mt-3 text-sm">
            Мы передали ваш запрос {success.dispatched_count} исполнител
            {success.dispatched_count === 1 ? 'ю' : 'ям'}. Они свяжутся с вами по указанному
            контакту.
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => {
            setSuccess(null)
            setName('')
            setContact('')
          }}
        >
          Отправить ещё один запрос
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Опишите, что вам нужно — мы подберём подходящих исполнителей на платформе и передадим им
        запрос.
      </p>

      <div className="space-y-2">
        <Label htmlFor="requester-name">Ваше имя</Label>
        <Input
          id="requester-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Иван Иванов"
          disabled={loading}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="requester-contact">Телефон или email</Label>
        <Input
          id="requester-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="+7 700 000 00 00 или email@example.com"
          disabled={loading}
          autoComplete="email tel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="request-text">Что вам нужно</Label>
        <Textarea
          id="request-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: две пары горных лыж на 12 марта, бюджет до 5000 ₸"
          disabled={loading}
          rows={5}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={loading || !name.trim() || !contact.trim() || !text.trim()}
        className={cn('h-10 rounded-xl px-5')}
      >
        <HandshakeIcon size={16} />
        {loading ? 'Отправка…' : 'Отправить запрос'}
      </Button>
    </form>
  )
}
