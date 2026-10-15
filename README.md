# NORD

Интернет-магазин мебели и предметов интерьера на Next.js 15 и Medusa 2.

Требуется Node.js 22.12+. Все команды выполняются из корня репозитория.

## Демо

Статическая версия без backend и базы данных. Каталог хранится в `apps/backend/src/data/catalog.json`, оформление заказа имитируется в браузере.

```sh
npm --prefix apps/storefront ci
npm run build:demo
npm run preview:demo
```

Открыть: http://127.0.0.1:4174/. Результат сборки: `apps/storefront/out-demo`.

## Запуск с Medusa

PostgreSQL запускается через Docker Compose.

```sh
npm ci
npm --prefix apps/storefront ci
docker compose up -d postgres
npm run setup
npm run dev:full
```

`setup` создаёт настройки, применяет миграции и загружает демо-данные. При следующих запусках достаточно `npm run dev:full` с работающей базой.

- Витрина: http://127.0.0.1:5180/.
- Админка: http://localhost:9000/app.

Создать администратора:

```sh
npm run create-admin --workspace @nord/backend -- --email admin@example.com --password YOUR_PASSWORD
```

Настройки: `apps/backend/.env` и `apps/storefront/.env.local`.

Сборка витрины: `npm run build`. Запуск сборки: `npm run preview`, адрес http://127.0.0.1:4173/. Medusa и база должны работать отдельно.

## GitHub Pages

На Pages размещается статическое демо.

1. В **Settings → Pages** выберите **Source: GitHub Actions**.
2. В **Actions → Deploy demo to GitHub Pages** нажмите **Run workflow**.

Путь репозитория подставляется автоматически. Публикация запускается вручную.

## Автор и лицензия

**Shutni[mz]** · [GNU GPLv3](LICENSE) (`GPL-3.0-only`).

Витрина основана на официальном Medusa starter; его [MIT-лицензия](apps/storefront/LICENSE) сохранена. Остальные уведомления — в [NOTICE](NOTICE).
