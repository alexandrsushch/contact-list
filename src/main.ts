type Contact = {
    id: string;
    name: string;
    position: string;
    phone: string;
};

type Field = 'name' | 'position' | 'phone';

type ContactValues = {
    name: string;
    position: string;
    phone: string;
};

type State = {
    contacts: Contact[];
    activeLetter: string | null;
};

type Groups = Record<string, Contact[]>;

const STORAGE_KEY = 'contacts';
const RU_LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ALL_LETTERS = [...RU_LETTERS, ...EN_LETTERS];

function byId<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Не найден элемент #${id}`);
    return el as T;
}

const els = {
    addForm: byId<HTMLFormElement>('addForm'),
    alphabet: byId<HTMLElement>('alphabet'),
    contacts: byId<HTMLUListElement>('contacts'),
    empty: byId<HTMLElement>('empty'),
    listTitle: byId<HTMLElement>('listTitle'),
    resetFilter: byId<HTMLButtonElement>('resetFilter'),
    clearAll: byId<HTMLButtonElement>('clearAll'),
    openSearch: byId<HTMLButtonElement>('openSearch'),
    editDialog: byId<HTMLDialogElement>('editDialog'),
    editForm: byId<HTMLFormElement>('editForm'),
    searchDialog: byId<HTMLDialogElement>('searchDialog'),
    searchInput: byId<HTMLInputElement>('searchInput'),
    searchResults: byId<HTMLUListElement>('searchResults'),
    searchEmpty: byId<HTMLElement>('searchEmpty'),
};

const state: State = {
    contacts: loadContacts(),
    activeLetter: null,
};

// ---------- Хранилище ----------

function loadContacts(): Contact[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Contact[]) : [];
    } catch {
        return [];
    }
}

function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
}

// ---------- Валидация ----------

const NAME_RE = /^[А-Яа-яЁёA-Za-z\s-]{2,30}$/;
const POSITION_RE = /^[А-Яа-яЁёA-Za-z0-9\s-]{2,50}$/;

function validateField(field: Field, value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return 'Поле не должно быть пустым';
    if (field === 'name') {
        return NAME_RE.test(trimmed)
            ? ''
            : 'Имя: 2–30 символов, буквы, пробел и дефис';
    }
    if (field === 'position') {
        return POSITION_RE.test(trimmed)
            ? ''
            : 'Должность: 2–50 символов, буквы, цифры, пробел и дефис';
    }
    if (field === 'phone') {
        const clean = trimmed.replace(/[\s()-]/g, '');
        return /^(\+7|8)\d{10}$/.test(clean)
            ? ''
            : 'Телефон: +7XXXXXXXXXX или 8XXXXXXXXXX';
    }
    return '';
}

function fieldInput(form: HTMLFormElement, name: string): HTMLInputElement {
    return form.elements.namedItem(name) as HTMLInputElement;
}

function validateForm(form: HTMLFormElement): ContactValues | null {
    const fields: Field[] = ['name', 'position', 'phone'];
    let firstInvalid: HTMLInputElement | null = null;
    const values: Record<Field, string> = { name: '', position: '', phone: '' };
    for (const name of fields) {
        const input = fieldInput(form, name);
        const error = validateField(name, input.value);
        values[name] = input.value.trim();
        setFieldError(form, name, error, input);
        if (error && !firstInvalid) firstInvalid = input;
    }
    if (firstInvalid) {
        firstInvalid.focus();
        return null;
    }
    return {
        name: values.name,
        position: values.position,
        phone: normalizePhone(values.phone),
    };
}

function setFieldError(
    form: HTMLFormElement,
    field: string,
    message: string,
    input?: HTMLInputElement
): void {
    const target = form.querySelector(`[data-error-for="${field}"]`);
    if (target) target.textContent = message;
    if (input) input.classList.toggle('invalid', Boolean(message));
}

function clearFormErrors(form: HTMLFormElement): void {
    form.querySelectorAll('.form__error').forEach((e) => (e.textContent = ''));
    form.querySelectorAll('input').forEach((i) => i.classList.remove('invalid'));
}

function normalizePhone(raw: string): string {
    const digits = raw.replace(/[^\d]/g, '');
    const clean = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
    return '+' + clean;
}

function formatPhone(phone: string): string {
    const d = phone.replace(/[^\d]/g, '');
    if (d.length !== 11) return phone;
    return `+${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

// ---------- CRUD ----------

function addContact({ name, position, phone }: ContactValues): void {
    state.contacts.push({
        id: crypto.randomUUID(),
        name,
        position,
        phone,
    });
    persist();
    render();
}

function updateContact(id: string, { name, position, phone }: ContactValues): void {
    const contact = state.contacts.find((c) => c.id === id);
    if (!contact) return;
    contact.name = name;
    contact.position = position;
    contact.phone = phone;
    persist();
    render();
}

function deleteContact(id: string): void {
    const contact = state.contacts.find((c) => c.id === id);
    if (!contact) return;
    if (!confirm(`Удалить контакт «${contact.name}»?`)) return;
    state.contacts = state.contacts.filter((c) => c.id !== id);
    persist();
    render();
}

function clearAll(): void {
    if (state.contacts.length === 0) return;
    if (!confirm('Удалить все контакты?')) return;
    state.contacts = [];
    state.activeLetter = null;
    persist();
    render();
}

// ---------- Рендер ----------

function getLetter(name: string): string {
    return name.trim().charAt(0).toUpperCase();
}

function groupByLetter(contacts: Contact[]): Groups {
    const groups: Groups = {};
    contacts.forEach((c) => {
        const letter = getLetter(c.name);
        (groups[letter] = groups[letter] || []).push(c);
    });
    Object.values(groups).forEach((arr) =>
        arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    );
    return groups;
}

function render(): void {
    const groups = groupByLetter(state.contacts);
    if (state.activeLetter && !groups[state.activeLetter]) {
        state.activeLetter = null;
    }
    renderAlphabet(groups);
    renderList(groups);
    if (els.searchDialog.open) renderSearchResults(els.searchInput.value);
}

function renderAlphabet(groups: Groups): void {
    els.alphabet.textContent = '';
    ALL_LETTERS.forEach((letter) => {
        const count = groups[letter] ? groups[letter].length : 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'alphabet__letter';
        btn.dataset.letter = letter;
        btn.disabled = count === 0;
        btn.setAttribute('aria-pressed', state.activeLetter === letter ? 'true' : 'false');

        const letterText = document.createElement('span');
        letterText.textContent = letter;
        btn.appendChild(letterText);

        const countText = document.createElement('span');
        countText.className = 'alphabet__count';
        countText.textContent = String(count);
        btn.appendChild(countText);

        els.alphabet.appendChild(btn);
    });
}

function renderList(groups: Groups): void {
    els.contacts.textContent = '';
    const total = state.contacts.length;

    if (total === 0) {
        els.empty.hidden = false;
        els.listTitle.textContent = 'Все контакты';
        els.resetFilter.hidden = true;
        return;
    }

    els.empty.hidden = true;

    let lettersToShow: string[];
    if (state.activeLetter && groups[state.activeLetter]) {
        lettersToShow = [state.activeLetter];
        els.listTitle.textContent = `Контакты на букву «${state.activeLetter}» — ${groups[state.activeLetter].length}`;
        els.resetFilter.hidden = false;
    } else {
        lettersToShow = ALL_LETTERS.filter((l) => groups[l]);
        els.listTitle.textContent = `Все контакты — ${total}`;
        els.resetFilter.hidden = true;
    }

    lettersToShow.forEach((letter) => {
        const title = document.createElement('li');
        title.className = 'contacts__group-title';
        title.textContent = letter;
        els.contacts.appendChild(title);
        groups[letter].forEach((c) => els.contacts.appendChild(buildContactItem(c)));
    });
}

function buildContactItem(contact: Contact): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'contact';
    li.dataset.id = contact.id;

    const name = document.createElement('div');
    name.className = 'contact__name';
    name.textContent = contact.name;

    const position = document.createElement('div');
    position.className = 'contact__position';
    position.textContent = contact.position;

    const phone = document.createElement('a');
    phone.className = 'contact__phone';
    phone.href = `tel:${contact.phone}`;
    phone.textContent = formatPhone(contact.phone);

    const actions = document.createElement('div');
    actions.className = 'contact__actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--icon';
    editBtn.dataset.action = 'edit';
    editBtn.title = 'Редактировать';
    editBtn.textContent = '✎';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--icon';
    delBtn.dataset.action = 'delete';
    delBtn.title = 'Удалить';
    delBtn.textContent = '✕';

    actions.append(editBtn, delBtn);
    li.append(name, position, phone, actions);
    return li;
}

// ---------- Модалка редактирования ----------

function openEditDialog(id: string): void {
    const contact = state.contacts.find((c) => c.id === id);
    if (!contact) return;
    clearFormErrors(els.editForm);
    fieldInput(els.editForm, 'id').value = contact.id;
    fieldInput(els.editForm, 'name').value = contact.name;
    fieldInput(els.editForm, 'position').value = contact.position;
    fieldInput(els.editForm, 'phone').value = formatPhone(contact.phone);
    els.editDialog.showModal();
}

// ---------- Модалка поиска ----------

function openSearch(): void {
    els.searchInput.value = '';
    renderSearchResults('');
    els.searchDialog.showModal();
    els.searchInput.focus();
}

function renderSearchResults(query: string): void {
    els.searchResults.textContent = '';
    const q = query.trim().toLowerCase();

    if (!q) {
        els.searchEmpty.hidden = false;
        els.searchEmpty.textContent = 'Введите запрос для поиска.';
        return;
    }

    const found = state.contacts.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        formatPhone(c.phone).toLowerCase().includes(q)
    );

    if (found.length === 0) {
        els.searchEmpty.hidden = false;
        els.searchEmpty.textContent = 'Ничего не найдено.';
        return;
    }

    els.searchEmpty.hidden = true;
    found
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .forEach((c) => els.searchResults.appendChild(buildContactItem(c)));
}

// ---------- Обработчики ----------

els.addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = validateForm(els.addForm);
    if (!values) return;
    addContact(values);
    els.addForm.reset();
    clearFormErrors(els.addForm);
});

els.addForm.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.name) return;
    setFieldError(els.addForm, input.name, '', input);
});

els.alphabet.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const btn = target?.closest<HTMLButtonElement>('.alphabet__letter');
    if (!btn || btn.disabled) return;
    const letter = btn.dataset.letter;
    if (!letter) return;
    state.activeLetter = state.activeLetter === letter ? null : letter;
    render();
});

function handleListClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    const btn = target?.closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    const item = btn.closest<HTMLLIElement>('.contact');
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;
    if (btn.dataset.action === 'edit') openEditDialog(id);
    if (btn.dataset.action === 'delete') deleteContact(id);
}

els.contacts.addEventListener('click', handleListClick);
els.searchResults.addEventListener('click', handleListClick);

els.resetFilter.addEventListener('click', () => {
    state.activeLetter = null;
    render();
});

els.clearAll.addEventListener('click', clearAll);

els.openSearch.addEventListener('click', openSearch);

els.searchInput.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    renderSearchResults(input.value);
});

els.editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = validateForm(els.editForm);
    if (!values) return;
    const id = fieldInput(els.editForm, 'id').value;
    updateContact(id, values);
    els.editDialog.close();
});

els.editForm.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.name) return;
    setFieldError(els.editForm, input.name, '', input);
});

document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (target && target.matches('[data-close]')) {
        const dialog = target.closest('dialog');
        if (dialog) dialog.close();
    }
});

render();
