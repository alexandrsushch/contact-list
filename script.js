(function () {
    'use strict';

    const STORAGE_KEY = 'contacts';
    const RU_LETTERS = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
    const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const ALL_LETTERS = [...RU_LETTERS, ...EN_LETTERS];

    const state = {
        contacts: loadContacts(),
        activeLetter: null,
    };

    const els = {
        addForm: document.getElementById('addForm'),
        alphabet: document.getElementById('alphabet'),
        contacts: document.getElementById('contacts'),
        empty: document.getElementById('empty'),
        listTitle: document.getElementById('listTitle'),
        resetFilter: document.getElementById('resetFilter'),
        clearAll: document.getElementById('clearAll'),
        openSearch: document.getElementById('openSearch'),
        editDialog: document.getElementById('editDialog'),
        editForm: document.getElementById('editForm'),
        searchDialog: document.getElementById('searchDialog'),
        searchInput: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        searchEmpty: document.getElementById('searchEmpty'),
    };

    // ---------- Хранилище ----------

    function loadContacts() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
    }

    // ---------- Валидация ----------

    const NAME_RE = /^[А-Яа-яЁёA-Za-z\s-]{2,30}$/;
    const POSITION_RE = /^[А-Яа-яЁёA-Za-z0-9\s-]{2,50}$/;

    function validateField(field, value) {
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
            const digits = trimmed.replace(/[^\d]/g, '');
            const okPlus = /^\+7\d{10}$/.test(trimmed.replace(/[\s()-]/g, ''));
            const ok8 = /^8\d{10}$/.test(trimmed.replace(/[\s()-]/g, ''));
            if ((okPlus || ok8) && digits.length >= 11) return '';
            return 'Телефон: +7XXXXXXXXXX или 8XXXXXXXXXX';
        }
        return '';
    }

    function validateForm(form) {
        const fields = ['name', 'position', 'phone'];
        let firstInvalid = null;
        const values = {};
        fields.forEach((name) => {
            const input = form.elements[name];
            const error = validateField(name, input.value);
            values[name] = input.value.trim();
            setFieldError(form, name, error, input);
            if (error && !firstInvalid) firstInvalid = input;
        });
        if (firstInvalid) {
            firstInvalid.focus();
            return null;
        }
        values.phone = normalizePhone(values.phone);
        return values;
    }

    function setFieldError(form, field, message, input) {
        const target = form.querySelector(`[data-error-for="${field}"]`);
        if (target) target.textContent = message;
        if (input) input.classList.toggle('invalid', Boolean(message));
    }

    function clearFormErrors(form) {
        form.querySelectorAll('.form__error').forEach((e) => (e.textContent = ''));
        form.querySelectorAll('input').forEach((i) => i.classList.remove('invalid'));
    }

    function normalizePhone(raw) {
        const digits = raw.replace(/[^\d]/g, '');
        const clean = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
        return '+' + clean;
    }

    function formatPhone(phone) {
        const d = phone.replace(/[^\d]/g, '');
        if (d.length !== 11) return phone;
        return `+${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
    }

    // ---------- CRUD ----------

    function addContact({ name, position, phone }) {
        state.contacts.push({
            id: crypto.randomUUID(),
            name,
            position,
            phone,
        });
        persist();
        render();
    }

    function updateContact(id, { name, position, phone }) {
        const contact = state.contacts.find((c) => c.id === id);
        if (!contact) return;
        contact.name = name;
        contact.position = position;
        contact.phone = phone;
        persist();
        render();
    }

    function deleteContact(id) {
        const contact = state.contacts.find((c) => c.id === id);
        if (!contact) return;
        if (!confirm(`Удалить контакт «${contact.name}»?`)) return;
        state.contacts = state.contacts.filter((c) => c.id !== id);
        persist();
        render();
    }

    function clearAll() {
        if (state.contacts.length === 0) return;
        if (!confirm('Удалить все контакты?')) return;
        state.contacts = [];
        state.activeLetter = null;
        persist();
        render();
    }

    // ---------- Рендер ----------

    function getLetter(name) {
        return name.trim().charAt(0).toUpperCase();
    }

    function groupByLetter(contacts) {
        const groups = {};
        contacts.forEach((c) => {
            const letter = getLetter(c.name);
            (groups[letter] = groups[letter] || []).push(c);
        });
        Object.values(groups).forEach((arr) =>
            arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        );
        return groups;
    }

    function render() {
        const groups = groupByLetter(state.contacts);
        renderAlphabet(groups);
        renderList(groups);
    }

    function renderAlphabet(groups) {
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
            countText.textContent = count;
            btn.appendChild(countText);

            els.alphabet.appendChild(btn);
        });
    }

    function renderList(groups) {
        els.contacts.textContent = '';
        const total = state.contacts.length;

        if (total === 0) {
            els.empty.hidden = false;
            els.listTitle.textContent = 'Все контакты';
            els.resetFilter.hidden = true;
            return;
        }

        els.empty.hidden = true;

        let lettersToShow;
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

    function buildContactItem(contact) {
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

    function openEditDialog(id) {
        const contact = state.contacts.find((c) => c.id === id);
        if (!contact) return;
        clearFormErrors(els.editForm);
        els.editForm.elements.id.value = contact.id;
        els.editForm.elements.name.value = contact.name;
        els.editForm.elements.position.value = contact.position;
        els.editForm.elements.phone.value = formatPhone(contact.phone);
        els.editDialog.showModal();
    }

    // ---------- Модалка поиска ----------

    function openSearch() {
        els.searchInput.value = '';
        renderSearchResults('');
        els.searchDialog.showModal();
        els.searchInput.focus();
    }

    function renderSearchResults(query) {
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
        const input = e.target;
        if (!input.name) return;
        setFieldError(els.addForm, input.name, '', input);
    });

    els.alphabet.addEventListener('click', (e) => {
        const btn = e.target.closest('.alphabet__letter');
        if (!btn || btn.disabled) return;
        const letter = btn.dataset.letter;
        state.activeLetter = state.activeLetter === letter ? null : letter;
        render();
    });

    els.contacts.addEventListener('click', handleListClick);
    els.searchResults.addEventListener('click', handleListClick);

    function handleListClick(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const item = btn.closest('.contact');
        if (!item) return;
        const id = item.dataset.id;
        if (btn.dataset.action === 'edit') openEditDialog(id);
        if (btn.dataset.action === 'delete') {
            deleteContact(id);
            if (els.searchDialog.open) renderSearchResults(els.searchInput.value);
        }
    }

    els.resetFilter.addEventListener('click', () => {
        state.activeLetter = null;
        render();
    });

    els.clearAll.addEventListener('click', clearAll);

    els.openSearch.addEventListener('click', openSearch);

    els.searchInput.addEventListener('input', (e) => {
        renderSearchResults(e.target.value);
    });

    els.editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const values = validateForm(els.editForm);
        if (!values) return;
        const id = els.editForm.elements.id.value;
        updateContact(id, values);
        els.editDialog.close();
    });

    els.editForm.addEventListener('input', (e) => {
        const input = e.target;
        if (!input.name) return;
        setFieldError(els.editForm, input.name, '', input);
    });

    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-close]')) {
            const dialog = e.target.closest('dialog');
            if (dialog) dialog.close();
        }
    });

    render();
})();
