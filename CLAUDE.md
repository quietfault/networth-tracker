# Срез — проектный файл для Claude Code

## Что это

**Срез** — персональный трекер состояния quietfault. Замена ручного Excel-файла, который ведётся с 2017 года.
Раз в месяц пользователь делает срез по всем активам → видит динамику cash и networth на графиках.

**Целевой пользователь:** человек с нестандартным портфелем — крипто (CEX + self-custody), банки, физические активы, товарный инвентарь.

---

## Стек

- **Frontend:** React + Vite + TypeScript
- **Оформление:** брендбук quietfault (`quietfault/marketing`, `brand/`). Токены и знаки лежат в этом репозитории вендорными копиями — см. «Бренд» ниже
- **Хранение и авторизация:** Supabase (Postgres + Auth, email/password). Решено осознанно — данные привязаны к аккаунту через RLS (`user_id = auth.uid()`), доступны с любого устройства после логина. Схема и политики: [supabase/schema.sql](supabase/schema.sql)
- **Деплой:** GitHub Pages, автоматически через GitHub Actions при пуше в `main` ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). `base: '/networth-tracker/'` в `vite.config.ts`, роутинг — HashRouter
- **Внешние API (read-only, без ключей пользователя по умолчанию):**
  - CoinGecko API — курсы токенов (бесплатно, без ключа)
  - Etherscan API V2 — балансы адресов на Ethereum + топ EVM-сетях, один ключ на все (нужен бесплатный ключ)
  - Blockchair API — баланс BTC-адресов (бесплатно, лимит ~30 req/day)
  - Solana public RPC (publicnode.com) — баланс SOL и SPL-токенов, без ключа
  - UniSat Open API — баланс Рун на BTC-адресах, нужен бесплатный ключ (экспериментально, см. ниже)

---

## Архитектура данных

### Снимок (Snapshot) — основная единица
```js
{
  id: "2024-12",           // год-месяц
  date: "2024-12-01",
  assets: {
    banks: [
      { name: "Сбер", amount: 150000, currency: "RUB" },
      { name: "Тинькофф", amount: 3200, currency: "USD" }
    ],
    crypto: [
      {
        type: "wallet",            // "wallet" | "cex"
        label: "MetaMask main",
        address: "0xABC...",       // для wallet — адрес для авто-подтяжки
        chain: "ethereum",         // ethereum | bitcoin | solana
        tokens: [
          { symbol: "ETH", amount: 1.5, priceUSD: null }  // price подтягивается
        ]
      },
      {
        type: "cex",
        label: "Binance",
        tokens: [
          { symbol: "BTC", amount: 0.12, priceUSD: null },
          { symbol: "USDT", amount: 2000, priceUSD: 1 }
        ]
      }
    ],
    inventory: [
      { name: "Nike Dunk Low Panda", qty: 2, pricePerUnit: 12000, currency: "RUB" }
    ],
    physical: [
      { name: "Машиноместо Москва", value: 1200000, currency: "RUB" },
      { name: "Асик Antminer S19", value: 800, currency: "USD" }
    ]
  },
  meta: {
    usdRub: 92.5,           // курс на момент снимка (вводится вручную)
    totalUSD: null,         // считается автоматически
    createdAt: "2024-12-01T10:00:00Z"
  }
}
```

Структура выше — концептуальная модель. Физически в Supabase три таблицы (`user_id` + RLS в каждой):

- `snapshots` — `period` (уникален с `user_id`), `snapshot_date`, `assets` (jsonb — вложенная структура banks/crypto/inventory/physical как выше), `usd_rub`, `total_usd`
- `wallets` — сохранённые адреса кошельков (`label`, `chain`, `address`), чтобы не вводить каждый раз
- `settings` — `base_currency`, `etherscan_api_key`, `unisat_api_key`

TypeScript-типы: [src/types/snapshot.ts](src/types/snapshot.ts). CRUD: [src/lib/snapshots.ts](src/lib/snapshots.ts), [src/lib/wallets.ts](src/lib/wallets.ts), [src/lib/settings.ts](src/lib/settings.ts).

---

## Бренд

Источник правды — приватный репозиторий `quietfault/marketing`, каталог
`brand/`: `BRANDBOOK.md`, `tokens/tokens.css`, `logo/`. Здесь лежат **копии**,
и правятся они только там:

| Здесь | Откуда |
|---|---|
| `src/styles/tokens.css` | `brand/tokens/tokens.css` (брендбук 1.0) |
| `src/assets/brand/lockup--dark.svg`, `lockup--light.svg` | `brand/logo/primary/` |
| `src/assets/brand/mark--dark.svg`, `mark--light.svg` | `brand/logo/primary/` |
| `src/assets/brand/bullet--dark.svg`, `bullet--light.svg` | `brand/logo/secondary/` |
| `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png` | `brand/logo/primary/` и `primary/png/` |

Правила, которые легко нарушить незаметно:

- **Цвет и размер берутся только из токенов.** Литерал вроде `#f97316` в
  компоненте — ошибка. Единственные собственные значения проекта живут в шапке
  `src/styles/app.css` (`--radius-control`, `--series-1…4`) и там же объяснены.
- **Один акцент.** Оранжевый — на один элемент в блоке.
- **Тёмный акцент `#f97316` не ставится на светлый фон** (2,63 : 1). Для
  светлой темы есть `--accent` и отдельный `--accent-text` для текста.
- **Шрифты самохостятся** через `@fontsource-variable/inter` и
  `@fontsource/jetbrains-mono`. Google Fonts и любой CDN запрещены — отдают IP
  посетителя.
- **Лого-блок не собирается вручную** из знака и слова: берётся готовый
  `lockup--*.svg`. `--mono`-версии через `<img>` не работают (`currentColor` не
  наследуется), поэтому вариант под тему выбирается CSS-классами `on-dark` /
  `on-light` в `src/components/Logo.tsx`.
- **Имя компании — `quietfault`**: строчными, слитно, в любом тексте.
- **Два знака не взаимозаменяемы.** «Пересборка» (полосы) — шапка, экран входа,
  фавикон. «Разлом» (кольцо) — буллет списка предупреждений и разделитель между
  кошельками в форме среза. Почему выбрано так — `DECISIONS.md`.

Тема: тёмная по умолчанию, светлая — переключателем в шапке, выбор хранится в
`localStorage` под ключом `qf-theme`, атрибут `data-theme` ставится инлайн-
скриптом в `index.html` до первой отрисовки.

---

## Структура страниц / роутинг

```
/ (Обзор)
  — последний срез: итоговая сумма networth
  — график networth по месяцам (line chart)
  — разбивка по категориям (pie или bar)

/snapshot/new
  — форма создания нового среза
  — по категориям: банки / крипто / инвентарь / физические активы
  — кнопка "Обновить балансы" — дёргает API для кошельков

/snapshot/:id
  — просмотр конкретного снимка

/wallets
  — управление кошельками (добавить адрес, выбрать сеть, дать label)

/settings
  — API ключи (Etherscan, UniSat), базовая валюта
```

---

## Ключевые UX-решения

1. **Кошельки вводятся один раз** — сохраняются в таблице `wallets`, при новом снимке автоматически появляются строками в разделе "Крипта"
2. **Курсы токенов обновляются при открытии формы** — через CoinGecko, без действий пользователя
3. **Все суммы конвертируются в USD** для единого networth. Курс USD/RUB вводится вручную, поддерживаются только RUB и USD как валюты банков/инвентаря/физики
4. **Снимок = иммутабельная запись** — нельзя редактировать прошлое, только добавлять новое (нет update-функции в data layer)
5. **Банки/инвентарь/физика/CEX предзаполняются из предыдущего снимка** — те же строки, меняются только суммы
6. **Экспорт в JSON** — на случай переезда или бэкапа. *Пока не реализовано.*

---

## API-интеграции

### CoinGecko (без ключа)
```js
// Курс токена
GET https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd

// Маппинг symbol → coingecko id (держать локально для популярных)
const COIN_IDS = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  SOL: 'solana',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  // ...дополнять по мере надобности
}
```

### Etherscan V2 — мультичейн (нужен бесплатный API ключ)
```js
// Один и тот же адрес — один и тот же аккаунт на всех EVM-сетях.
// Баланс проверяется по списку chainId, возвращаются только сети с ненулевым балансом.
GET https://api.etherscan.io/v2/api?chainid={CHAIN_ID}&module=account&action=balance&address={ADDRESS}&tag=latest&apikey={KEY}

// Проверяемые сети (src/lib/api/etherscan.ts, EVM_CHAINS):
// 1 Ethereum, 56 BNB Chain, 137 Polygon, 42161 Arbitrum One,
// 10 Optimism, 8453 Base, 43114 Avalanche
```
Бесплатный тариф — 5 запросов в секунду на ключ. Семь сетей параллельно
(`Promise.all`) в этот лимит не влезали, и весь кошелёк падал с невнятным
«NOTOK». Поэтому сети опрашиваются последовательно с паузой 250 мс, лимитные
ответы ретраятся, а сеть, которая всё-таки не ответила, попадает в
`errors[]` — остальные балансы при этом показываются.
Ошибку V2 отдаёт тремя разными способами (`status:"0"` + `result` с текстом,
`error.message`, HTTP-код), полезный текст обычно в `result`.

**Не подтягивается:** ERC-20 токены на EVM-сетях — только нативная монета.
Список токенов на адресе в Etherscan V2 — платный (Pro) эндпоинт; бесплатная
альтернатива (Blockscout) не проверена. Токены на EVM вносятся руками.

### Blockchair (без ключа, лимиты ~30 req/day)
```js
// Баланс BTC-адреса
GET https://api.blockchair.com/bitcoin/dashboards/address/{ADDRESS}
// → data[ADDRESS].address.balance (в сатоши, делить на 1e8)
// При превышении лимита возвращает HTTP 430 с полем context.error — показываем как есть
```

### Solana public RPC (без ключа)
```js
// Официальный api.mainnet-beta.solana.com блокирует браузерные запросы (403,
// CORS). Используем зеркало publicnode.com, у которого есть Access-Control-Allow-Origin: *.
POST https://solana-rpc.publicnode.com
{ "jsonrpc": "2.0", "id": 1, "method": "getBalance", "params": ["{ADDRESS}"] }
// → result.value в лампортах, делить на 1e9

// SPL-токены — тем же RPC, по двум программам сразу: старый SPL Token
// (Tokenkeg...) и Token-2022 (Tokenz...). Новые монеты живут во второй,
// поэтому одной программы мало.
{ "method": "getTokenAccountsByOwner",
  "params": ["{ADDRESS}", { "programId": "{PROGRAM}" }, { "encoding": "jsonParsed" }] }
// → result.value[].account.data.parsed.info.tokenAmount.uiAmountString
// Отбрасываются нулевые аккаунты и NFT (decimals = 0), несколько аккаунтов
// одного минта суммируются.
```
RPC отдаёт минты, а не тикеры. Популярные минты подписаны локальной картой
(`MINT_SYMBOLS` в [src/lib/api/solana.ts](src/lib/api/solana.ts)), остальные
показываются как `EPjF…TDt1v` — символ можно поправить руками в форме снимка.
Цена таких токенов берётся по адресу минта:
`GET /api/v3/simple/token_price/solana?contract_addresses={MINT}&vs_currencies=usd`

### UniSat Open API — баланс Рун на BTC
```js
GET https://open-api.unisat.io/v1/indexer/address/{ADDRESS}/runes/balance-list?start=0&limit=100
Authorization: Bearer {KEY}
// → { code: 0, data: { detail: [{ rune, spacedRune, amount, divisibility, symbol, runeid }] } }
// amount — строка в минимальных единицах, делить на 10^divisibility
// symbol — декоративный глиф (¤, ⧉), для отображения использовать spacedRune
```
Бесплатный ключ — регистрация на developer.unisat.io. Проверено вживую с реальным
ключом 2026-07-09: CORS открыт (`Access-Control-Allow-Origin: *`), работает из браузера.
`start`/`limit` передаются явно — без диапазона индексатор в некоторых
деплоях отдаёт пустой список. Если ключ не задан, это теперь видно строкой
«UniSat API key не задан», а не молча пропущенным разделом.

### Общий слой: [src/lib/walletAssets.ts](src/lib/walletAssets.ts)
`/wallets` и форма снимка ходят за балансами одной функцией
`fetchWalletAssets(wallet, keys)`. Правило одно на все сети: **каждый источник
запрашивается независимо и падает независимо**. Результат — `{ assets, errors }`,
где `errors` — частичные отказы (лимит Blockchair, отсутствующий ключ, мёртвая
EVM-сеть), которые показываются рядом с теми балансами, что загрузились.
Цены докладываются одним проходом: известные тикеры — по `COIN_IDS`,
остальное — по адресу контракта/минта.

---

## Текущий статус

Готово: оформление по брендбуку (тёмная/светлая тема, знаки, шрифты),
Supabase-схема + RLS, auth (email/password), типы и data layer,
`/wallets` (мультичейн EVM + Solana + Runes-балансы), `/snapshot/new` (полная форма
с предзаполнением, "Обновить балансы", live-расчёт итога), `/settings` (API-ключи),
Dashboard (line chart networth + pie разбивка по категориям). Задеплоено на
GitHub Pages: https://quietfault.github.io/networth-tracker/ (HashRouter,
автодеплой через GitHub Actions при пуше в `main`, см.
[.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

Не сделано:
- `/snapshot/:id` — сейчас заглушка, не показывает реальные данные снимка
- Экспорт в JSON
- Закрыть регистрацию в Supabase (Authentication → Sign In / Providers →
  выключить "Allow new users to sign up") после того как основной аккаунт
  создан — сейчас форма регистрации доступна всем, кто зайдёт на сайт

См. также [DECISIONS.md](DECISIONS.md) — почему выбраны именно эти решения,
какие альтернативы отвергнуты и найденные по пути ловушки (Supabase-гранты,
GitHub Actions secrets/environments).

---

## Важные ограничения

- **Данные видны только после логина** — RLS на всех таблицах (`user_id = auth.uid()`), плюс явные `GRANT` только для роли `authenticated` (анонимная роль не имеет доступа к таблицам вообще, не только на уровне строк)
- **Не хранить приватные ключи** — только публичные адреса для чтения балансов
- **Etherscan/UniSat ключи пользователя — в таблице `settings`**, не в коде, не в `.env`. Supabase anon key — в `.env` (это ожидаемо и безопасно для Supabase, доступ реально ограничивает RLS)
- Поддержка мобильного браузера желательна, но не приоритет

---

## Контекст пользователя

- Кошельки: self-custody (Ethereum-совместимые + возможно BTC/Solana) + CEX (Binance/Bybit)
- Инвентарь: был товар (кроссовки), сейчас неактуально — но структура нужна
- Физические активы: машиноместа, майнинг-оборудование
- Банки: RUB и USD счета
- Ведёт учёт с 2017, данные из Excel нужно будет импортировать вручную (не автоматически)
- Опыт: пишет логику с AI-помощью, деплой через GitHub Pages уже умеет (есть другой проект)
- Стек знаком: React + Vite + GitHub Pages

---

## Как запустить локально

```bash
npm install
# .env нужен VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (см. .env.example),
# схема БД — supabase/schema.sql, выполнить в Supabase SQL Editor
npm run dev
```
