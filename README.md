# Net Worth Tracker

Персональный трекер состояния. Раз в месяц делается срез по всем активам —
банки, крипта (кошельки и биржи), товарный инвентарь, физические активы — и
приложение показывает динамику на графиках.

Замена ручного Excel-файла, который до этого вёлся с 2017 года. Балансы
крипто-кошельков и курсы токенов подтягиваются автоматически по публичным
адресам, остальное вводится руками.

**Демо:** https://quietfault.github.io/networth-tracker/

Данные лежат в Supabase и привязаны к аккаунту — доступны с любого устройства
после входа по email и паролю. Чужие строки закрыты Row Level Security.

## Стек

React 19 + Vite (TypeScript) · Supabase (Postgres + Auth) · react-router-dom
(HashRouter) · recharts · oxlint · деплой на GitHub Pages через GitHub Actions.

Внешние API, все read-only: CoinGecko (курсы), Etherscan V2 (балансы на 7
EVM-сетях), Blockchair (BTC), Solana public RPC (SOL), UniSat (Руны на BTC).

## Установка

```bash
git clone https://github.com/quietfault/networth-tracker.git
cd networth-tracker
npm install
```

**1. База.** Создайте проект в [Supabase](https://supabase.com), откройте
SQL Editor → New query, вставьте целиком [`supabase/schema.sql`](supabase/schema.sql)
и нажмите Run. Файл содержит таблицы, RLS-политики и гранты для роли
`authenticated` — без грантов запрос упрётся в `42501 permission denied` ещё до
применения политик.

**2. Ключи.** Скопируйте `.env.example` в `.env` и заполните значениями из
Supabase → Project Settings → API:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Anon key публичен по дизайну Supabase — доступ к данным ограничивает RLS, а не
секретность ключа. Тем не менее `.env` в гите не место, он в `.gitignore`.

Ключи Etherscan и UniSat в `.env` не кладутся: они вводятся в интерфейсе и
хранятся в таблице `settings`, у каждого пользователя свои.

## Запуск

```bash
npm run dev      # дев-сервер
npm run build    # tsc -b + сборка в dist/
npm run lint     # oxlint
npm run preview  # посмотреть собранное локально
```

## Деплой

Автоматический: пуш в `main` запускает
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), который собирает
проект и публикует на GitHub Pages. Руками ничего запускать не надо.

`VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` подставляются в сборку из
секретов GitHub — локальный `.env` в CI не участвует.

В `vite.config.ts` задан `base: '/networth-tracker/'` — он должен совпадать с
именем репозитория. Роутинг на HashRouter (`/#/wallets`), чтобы не подпирать
GitHub Pages трюком с `404.html`.

## Модель данных

Три таблицы, все с `user_id` и RLS по `user_id = auth.uid()`:

- `snapshots` — месячный срез: `period`, `snapshot_date`, `assets` (jsonb со
  вложенной структурой banks/crypto/inventory/physical), `usd_rub`, `total_usd`
- `wallets` — сохранённые публичные адреса кошельков, чтобы не вводить каждый раз
- `settings` — базовая валюта и пользовательские API-ключи

Снимок иммутабелен: прошлое не редактируется, добавляются только новые срезы.
Приватные ключи не хранятся нигде — только публичные адреса для чтения балансов.

Подробнее — [CLAUDE.md](CLAUDE.md), решения и отвергнутые варианты —
[DECISIONS.md](DECISIONS.md).
