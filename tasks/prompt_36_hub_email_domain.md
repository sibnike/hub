> Открой `tasks/prompt_36_hub_email_domain.md` и выполни задачу. Положи в `mega-hub/tasks/`. Простая задача — убедиться что весь email-код Hub использует домен `yanbada.com` и работает с Resend.

# Email domain check: yanbada.com

## Контекст

В Resend верифицирован домен `yanbada.com`. Все email из Hub должны отправляться с него.

## Задача

### 1. Найти все upоминания доменов в email-коде

```bash
grep -rn "@ota.kz\|@yanbada.com" lib/ --include="*.ts"
grep -rn "from:" lib/email/ --include="*.ts"
```

### 2. Проверить отправку

В `lib/email/send-invitation.ts` (и других send-*) убедись:
- `from` равен `Yanbada <hub@yanbada.com>` (или другой адрес на `yanbada.com`)
- Используется `process.env.RESEND_FROM_EMAIL` с дефолтом на `yanbada.com`

Если хардкод — заменить на:

```typescript
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Yanbada Hub <hub@yanbada.com>'

await resend.emails.send({
  from: FROM_EMAIL,
  to: email,
  // ...
})
```

### 3. ENV в .env.example

```env
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=Yanbada Hub <hub@yanbada.com>
```

### 4. Сборка и коммит

```bash
npm run build
git add .
git commit -m "chore: ensure email uses yanbada.com domain"
git push
```

## Результат

- [ ] Все email отправляются с `@yanbada.com`
- [ ] `RESEND_FROM_EMAIL` поддерживается через env
- [ ] Билд успешен
- [ ] Закоммичено
