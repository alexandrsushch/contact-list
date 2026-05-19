# Список контактов

Учебный проект на TypeScript + Vite. Реализован аналог [a-khramtsov.github.io/contactList](https://a-khramtsov.github.io/contactList/).

## Что умеет

- Добавление контактов с валидацией имени, должности и телефона.
- Список сгруппирован по первой букве имени. Рядом с каждой буквой алфавита — количество контактов.
- Клик по букве — фильтр списка по этой букве, повторный клик или кнопка «Показать всех» — сброс.
- Редактирование контакта в модальном окне.
- Удаление одного контакта и удаление всех сразу (с подтверждением).
- Поиск по имени, должности и телефону в отдельной модалке. В результатах поиска доступны те же действия — редактирование и удаление.
- Все данные сохраняются в `localStorage` и подтягиваются после перезагрузки страницы.

## Стек

- **TypeScript 5** — строгая типизация (`strict: true`).
- **Vite 5** — дев-сервер с hot reload, продакшн-сборка.
- **Vanilla DOM API** — без фреймворков, только нативный `document.*`, `dialog`, `dataset`.
- **localStorage** — хранение контактов между сессиями.

## Структура

```
contactList/
├── index.html        — разметка страницы и модалок
├── style.css         — стили
├── src/
│   └── main.ts       — логика: state, рендер, валидация, обработчики событий
├── tsconfig.json
├── package.json
└── README.md
```

Единый источник истины — массив `state.contacts` в `src/main.ts`. Любое изменение идёт через функции `addContact / updateContact / deleteContact / clearAll`, затем `persist()` в `localStorage` и `render()` перерисовывает UI.

## Типы данных

Описаны в начале [src/main.ts](src/main.ts):

```ts
type Contact = {
    id: string;       // crypto.randomUUID()
    name: string;
    position: string;
    phone: string;    // нормализованный, в формате +7XXXXXXXXXX
};

type Field = 'name' | 'position' | 'phone';

type ContactValues = {
    name: string;
    position: string;
    phone: string;
};

type State = {
    contacts: Contact[];
    activeLetter: string | null;  // буква текущего фильтра, null = «все»
};

type Groups = Record<string, Contact[]>;  // контакты, сгруппированные по первой букве
```

## Требования

- **Node.js** ≥ 18
- **npm** (идёт в комплекте с Node)

## Как запустить

```bash
npm install
npm run dev       # дев-сервер с hot reload
npm run build     # сборка в dist/
npm run preview   # предпросмотр собранной версии
npm run typecheck # проверка типов без сборки
```

## Правила валидации

- **Имя** — 2–30 символов: буквы (кириллица/латиница), пробел, дефис.
- **Должность** — 2–50 символов: буквы, цифры, пробел, дефис.
- **Телефон** — `+7XXXXXXXXXX` или `8XXXXXXXXXX`; разрешены скобки, пробелы и дефисы для удобства ввода.
