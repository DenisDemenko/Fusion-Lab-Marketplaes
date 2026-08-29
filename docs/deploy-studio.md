# Деплой Nova під `/studio` (Фаза G3)

Що маємо на старті: маркетплейс уже в проді (Vercel — `app.fusionlab.in.ua`,
Railway — `api.fusionlab.in.ua`), Nova (Book_Creality) **ніде не розгорнута**
і навіть не має git-remote. Код з обох боків готовий і перевірений локально;
нижче — тільки те, що потребує твоїх акаунтів.

**Чому саме `/studio`, а не піддомен.** Браузер тримає стан входу Firebase
окремо для кожного origin. Піддомен `studio.fusionlab.in.ua` був би окремим
origin — і єдина сесія з Фази G2 стала б неможливою. Префікс шляху лишає
обидва застосунки на одному origin, і саме це робить G2 дешевою.

---

## Крок 1. Викласти Nova на GitHub

Railway деплоїть із репозиторію, а в Nova зараз навіть немає remote —
історія лише локальна.

```bash
cd D:/Rama/Book_Creality
git remote add origin https://github.com/DenisDemenko/<назва-репо>
git push -u origin master
```

Репозиторій створи спершу на GitHub (приватний — у ньому є `.env.example`
з описом ключів, самих ключів немає: `.env` у `.gitignore`).

> Перед першим пушем варто ще раз глянути `git status --ignored`, щоб
> переконатись, що `.env` і `data/` справді ігноруються — там реальні
> ключі й акаунти.

## Крок 2. Створити сервіс на Railway

1. Railway → **New Project** → **Deploy from GitHub repo** → репозиторій Nova.
2. Railway підхопить `railway.json` у корені й збиратиме за `Dockerfile`
   (обидва вже в репозиторії, окремо нічого налаштовувати не треба).

Образ на Node 22, а не 20 як в API: сховище Nova стоїть на вбудованому
`node:sqlite`, який з'явився у 22.5. На Node 20 модуля немає, і застосунок
тихо відкотиться на JSON-файли повз базу.

## Крок 3. Постійний том (обов'язково)

Railway → сервіс → **Variables/Settings** → **Volumes** → додати том,
**mount path: `/data`**.

Без тому при кожному перезапуску зникнуть і база користувачів
(`/data/nova-studio.db`), і згенеровані зображення (`/data/generated`).
Dockerfile уже вказує на ці шляхи через `DATA_DIR` і `GENERATED_IMAGES_DIR`.

## Крок 4. Змінні оточення

Серверні (секрети — беруться з `.env` API маркетплейсу, той самий
сервісний акаунт Firebase):

| Змінна | Значення |
|---|---|
| `FIREBASE_PROJECT_ID` | `fusionlab-acc2d` |
| `FIREBASE_CLIENT_EMAIL` | з `.env` API маркетплейсу |
| `FIREBASE_PRIVATE_KEY` | з `.env` API маркетплейсу |
| `ADMIN_EMAIL` | `tropazemli@gmail.com` |
| `GEMINI_API_KEY` | ключ Gemini (без нього ШІ-функції не працюють) |
| `APP_URL` | `https://app.fusionlab.in.ua/studio` |

Клієнтські — потрапляють у бандл **на етапі збірки**, тож мають бути задані
до деплою (Vite підставляє `VITE_*` статично; секретів тут немає — ці
значення й так видно в браузері):

| Змінна | Значення |
|---|---|
| `NOVA_BASE_PATH` | `/studio/` |
| `VITE_FIREBASE_API_KEY` | з `.env.local` веб-застосунку маркетплейсу |
| `VITE_FIREBASE_AUTH_DOMAIN` | `fusionlab-acc2d.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `fusionlab-acc2d` |
| `VITE_NOVA_WS_URL` | *(заповнюється на кроці 5)* |

> Якщо після деплою в консолі браузера видно, що Firebase-конфіг порожній —
> значить Railway не передав `VITE_*` у збірку як build args. Тоді додай їх
> явно у налаштуваннях збірки сервісу (у `Dockerfile` відповідні `ARG` уже
> оголошені).

## Крок 5. Домен Nova і WebSocket

Railway → сервіс → **Settings** → **Networking** → **Generate Domain**.
Отримаєш щось на кшталт `nova-production-xxxx.up.railway.app`.

Тепер повернись до змінних і додай:

```
VITE_NOVA_WS_URL=wss://nova-production-xxxx.up.railway.app/ws
```

і **передеплой** (значення зашивається у збірку, тому саме передеплой, а не
просто перезапуск).

**Чому WebSocket окремо.** Rewrite Vercel не проксує upgrade-з'єднання, тож
спільне редагування книг у Nova підключається напряму на її власний хост,
поки весь HTTP іде під `/studio`. Крос-оригінний WebSocket — це нормально:
правило одного походження на нього не діє, сервер сам перевіряє Origin.

## Крок 6. Увімкнути rewrite на Vercel

Vercel → проєкт маркетплейсу → **Settings** → **Environment Variables**:

```
NOVA_ORIGIN=https://nova-production-xxxx.up.railway.app
```

(домен Nova з кроку 5, **без** кінцевого слеша), далі **Redeploy**.

Поки цієї змінної немає, rewrite просто не додається — тому зміни й лежать
у master безпечно, нічого в поточному проді не змінюючи.

## Крок 7. Дозволити домен у Firebase

Firebase Console → Authentication → Settings → **Authorized domains** →
переконайся, що `app.fusionlab.in.ua` там є. Без цього вхід через Google
з-під `/studio` відмовить.

## Крок 8. Перевірка

1. `https://app.fusionlab.in.ua/studio` — має відкритись екран входу Nova.
2. `https://app.fusionlab.in.ua/studio/api/auth/status` — має віддати JSON
   із `"firebaseEnabled": true`.
3. У логах Railway при старті має бути `[db] Сховище: SQLite (...)`.
   Якщо там «JSON-файли» — не змонтований том або не та версія Node.
4. Увійди в маркетплейсі, потім відкрий `/studio` — Firebase-стан спільний,
   бо origin один. *(Автоматичний підхват сесії без повторного натискання
   «Увійти» — це вже Фаза G2, вона ще не зроблена.)*
5. Перевір, що сам маркетплейс не постраждав: `/`, `/en`, `/catalog`,
   `/teams`, `/schedule`.

---

## Відомі межі

- **Автоматичного SSO ще немає.** Спільний origin — це передумова; саме
  дротування (побачити готового Firebase-користувача й мовчки обміняти
  токен на сесію Nova) робиться у Фазі G2.
- **Ролі поки різні** в двох системах. Рішення звести їх до одного набору
  прийнято, але не реалізовано — див. G2 у `migration-plan.md`.
- **Nova не має health-check ендпоінта** (на відміну від API маркетплейсу з
  `/health`). Railway орієнтуватиметься лише на те, що процес живий.
