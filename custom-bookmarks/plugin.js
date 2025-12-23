/**
 * Lampa TV Plugin: Custom Bookmarks Categories
 * Author: Dmitro & Copilot
 * Version: 1.0.0
 * Storage key: 'custom_bookmarks_categories'
 *
 * Features:
 * - Create, rename, delete categories
 * - Add items (movie, tv) into categories with metadata
 * - Remove items from categories
 * - View items per category (grid with posters and titles)
 * - Local storage only (no cloud sync)
 * - Hooks to add "Add to category" into item details if available
 */
(function() {
    // --- Safe guards ---
    if (typeof window === 'undefined' || typeof Lampa === 'undefined') {
        console.log('[CustomBookmarks] Lampa environment not detected');
        return;
    }

    const STORAGE_KEY = 'custom_bookmarks_categories';
    const NS = 'custom_bookmarks';
    const ICON = 'bookmark';

    // --- Storage helpers ---
    const Store = {
        read() {
            try {
                const raw = Storage.get(STORAGE_KEY, '[]');
                const data = JSON.parse(raw);
                if (Array.isArray(data)) return data;
                return [];
            } catch (e) {
                console.log('[CustomBookmarks] Storage parse error', e);
                return [];
            }
        },
        write(categories) {
            try {
                Storage.set(STORAGE_KEY, JSON.stringify(categories || []));
            } catch (e) {
                console.log('[CustomBookmarks] Storage write error', e);
            }
        }
    };

    // --- Data model helpers ---
    function normalizeItem(item) {
        // Expected minimal schema used across Lampa cards/details
        // Fallbacks are applied for different sources/providers
        return {
            id: item.id || item.tmdb_id || item.imdb_id || item.card_id || String(Date.now()),
            type: item.type || item.media_type || (item.season ? 'tv' : 'movie') || 'movie',
            title: item.title || item.name || item.original_title || item.original_name || 'Без назви',
            year: item.year || item.release_date?.slice(0,4) || item.first_air_date?.slice(0,4) || '',
            poster: item.poster || item.poster_path || item.image || '',
            source: item.source || 'lampa',
            payload: item // keep original payload for future expansions
        };
    }

    function findCategory(categories, name) {
        return categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    }

    function addCategory(categories, name) {
        if (!name || !name.trim()) return { ok: false, reason: 'Пуста назва' };
        if (findCategory(categories, name)) return { ok: false, reason: 'Категорія вже існує' };
        categories.push({ name: name.trim(), items: [] });
        return { ok: true };
    }

    function renameCategory(categories, oldName, newName) {
        const cat = findCategory(categories, oldName);
        if (!cat) return { ok: false, reason: 'Не знайдено' };
        if (!newName || !newName.trim()) return { ok: false, reason: 'Пуста назва' };
        if (oldName.trim().toLowerCase() === newName.trim().toLowerCase()) return { ok: true };
        if (findCategory(categories, newName)) return { ok: false, reason: 'Назва зайнята' };
        cat.name = newName.trim();
        return { ok: true };
    }

    function deleteCategory(categories, name) {
        const idx = categories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
        if (idx === -1) return { ok: false, reason: 'Не знайдено' };
        categories.splice(idx, 1);
        return { ok: true };
    }

    function addItem(categories, catName, item) {
        const cat = findCategory(categories, catName);
        if (!cat) return { ok: false, reason: 'Категорія не знайдена' };
        const normalized = normalizeItem(item);
        const exists = cat.items.some(i => (i.id === normalized.id) && (i.type === normalized.type));
        if (exists) return { ok: false, reason: 'Вже у категорії' };
        cat.items.push(normalized);
        return { ok: true };
    }

    function removeItem(categories, catName, itemId, itemType) {
        const cat = findCategory(categories, catName);
        if (!cat) return { ok: false, reason: 'Категорія не знайдена' };
        const idx = cat.items.findIndex(i => i.id === itemId && i.type === itemType);
        if (idx === -1) return { ok: false, reason: 'Елемент не знайдено' };
        cat.items.splice(idx, 1);
        return { ok: true };
    }

    // --- UI helpers ---
    function notify(text) {
        try {
            Lampa.Noty.show(text);
        } catch (e) {
            console.log('[CustomBookmarks]', text);
        }
    }

    function promptModal(title, placeholder, submitLabel, onSubmit) {
        const html = `
            <div class="selector">
                <div class="simple-text">${title}</div>
                <div class="input">
                    <input type="text" id="${NS}-input" placeholder="${placeholder}" />
                </div>
                <div class="buttons">
                    <div class="button selector">${submitLabel}</div>
                    <div class="button selector">Скасувати</div>
                </div>
            </div>`;
        Lampa.Modal.open({
            title,
            html,
            onBack: () => Lampa.Modal.close(),
            onSelect: (el) => {
                const btnText = el.textContent.trim();
                if (btnText === submitLabel) {
                    const val = document.getElementById(`${NS}-input`)?.value || '';
                    Lampa.Modal.close();
                    onSubmit(val.trim());
                } else if (btnText === 'Скасувати') {
                    Lampa.Modal.close();
                }
            }
        });
    }

    function confirmModal(title, text, okLabel, onOk) {
        const html = `
            <div class="selector">
                <div class="simple-text">${text}</div>
                <div class="buttons">
                    <div class="button selector">${okLabel}</div>
                    <div class="button selector">Скасувати</div>
                </div>
            </div>`;
        Lampa.Modal.open({
            title,
            html,
            onBack: () => Lampa.Modal.close(),
            onSelect: (el) => {
                const btnText = el.textContent.trim();
                if (btnText === okLabel) {
                    Lampa.Modal.close();
                    onOk();
                } else if (btnText === 'Скасувати') {
                    Lampa.Modal.close();
                }
            }
        });
    }

    // --- Component: Categories Home ---
    const CategoriesComponent = (function() {
        function renderList(categories) {
            const items = categories.map(c => ({
                title: c.name,
                // Provide counts for quick context
                subtitle: `Елементів: ${c.items.length}`,
                icon: ICON,
                component: `${NS}_category_view`,
                catName: c.name
            }));

            return items;
        }

        function open() {
            const categories = Store.read();
            const items = renderList(categories);

            // Activity list view
            Lampa.Activity.push({
                url: NS + '_home',
                title: 'Мої категорії',
                component: 'list',
                items,
                onBack: () => {},
                // Add header actions
                onRender: () => {
                    // Add header buttons
                    const header = document.querySelector('.activity .head .buttons');
                    if (header && !header.querySelector(`.${NS}-add-btn`)) {
                        const addBtn = document.createElement('div');
                        addBtn.className = `button ${NS}-add-btn selector`;
                        addBtn.textContent = 'Створити категорію';
                        addBtn.addEventListener('click', () => {
                            promptModal('Нова категорія', 'Наприклад: Документальні', 'Створити', (val) => {
                                const cats = Store.read();
                                const res = addCategory(cats, val);
                                if (!res.ok) return notify('Помилка: ' + (res.reason || ''));
                                Store.write(cats);
                                notify('Категорію створено');
                                open(); // rerender
                            });
                        });
                        header.appendChild(addBtn);
                    }
                },
                onSelect: (card) => {
                    // Navigate to category items view
                    CategoryViewComponent.open(card.catName);
                }
            });
        }

        return { open };
    })();

    // --- Component: Category View ---
    const CategoryViewComponent = (function() {
        function open(catName) {
            const categories = Store.read();
            const cat = findCategory(categories, catName);
            if (!cat) {
                notify('Категорія не знайдена');
                return;
            }

            // Build items as cards
            const items = cat.items.map(i => ({
                title: i.title,
                subtitle: i.year ? String(i.year) : '',
                poster: i.poster || '',
                type: i.type,
                id: i.id,
                _catName: cat.name
            }));

            Lampa.Activity.push({
                url: `${NS}_category_view_${cat.name}`,
                title: `Категорія: ${cat.name}`,
                component: 'list',
                items,
                onBack: () => {},
                onRender: () => {
                    const header = document.querySelector('.activity .head .buttons');
                    if (header) {
                        // Rename
                        if (!header.querySelector(`.${NS}-rename-btn`)) {
                            const renameBtn = document.createElement('div');
                            renameBtn.className = `button ${NS}-rename-btn selector`;
                            renameBtn.textContent = 'Перейменувати';
                            renameBtn.addEventListener('click', () => {
                                promptModal('Перейменувати категорію', cat.name, 'Зберегти', (newName) => {
                                    const cats = Store.read();
                                    const res = renameCategory(cats, cat.name, newName);
                                    if (!res.ok) return notify('Помилка: ' + (res.reason || ''));
                                    Store.write(cats);
                                    notify('Перейменовано');
                                    CategoryViewComponent.open(newName);
                                });
                            });
                            header.appendChild(renameBtn);
                        }
                        // Delete category
                        if (!header.querySelector(`.${NS}-delete-btn`)) {
                            const delBtn = document.createElement('div');
                            delBtn.className = `button ${NS}-delete-btn selector`;
                            delBtn.textContent = 'Видалити категорію';
                            delBtn.addEventListener('click', () => {
                                confirmModal('Видалити', `Видалити категорію "${cat.name}" з усіма елементами?`, 'Так, видалити', () => {
                                    const cats = Store.read();
                                    const res = deleteCategory(cats, cat.name);
                                    if (!res.ok) return notify('Помилка: ' + (res.reason || ''));
                                    Store.write(cats);
                                    notify('Категорію видалено');
                                    CategoriesComponent.open();
                                });
                            });
                            header.appendChild(delBtn);
                        }
                        // Add item manually
                        if (!header.querySelector(`.${NS}-manual-add-btn`)) {
                            const manBtn = document.createElement('div');
                            manBtn.className = `button ${NS}-manual-add-btn selector`;
                            manBtn.textContent = 'Додати вручну';
                            manBtn.addEventListener('click', () => {
                                // Minimal manual add: enter title only
                                promptModal('Додати елемент', 'Назва (обов’язково)', 'Додати', (title) => {
                                    if (!title) return notify('Назва пуста');
                                    const cats = Store.read();
                                    const res = addItem(cats, cat.name, { title, type: 'movie', id: String(Date.now()) });
                                    if (!res.ok) return notify('Помилка: ' + (res.reason || ''));
                                    Store.write(cats);
                                    notify('Додано');
                                    CategoryViewComponent.open(cat.name);
                                });
                            });
                            header.appendChild(manBtn);
                        }
                    }
                },
                onSelect: (card) => {
                    // Open details if possible, otherwise show actions
                    const actions = [
                        { label: 'Відкрити інформацію (якщо доступно)', action: 'open' },
                        { label: 'Видалити з категорії', action: 'remove' }
                    ];
                    const html = `
                        <div class="selector">
                            ${actions.map(a => `<div class="button selector">${a.label}</div>`).join('')}
                            <div class="button selector">Скасувати</div>
                        </div>`;
                    Lampa.Modal.open({
                        title: card.title,
                        html,
                        onBack: () => Lampa.Modal.close(),
                        onSelect: (el) => {
                            const text = el.textContent.trim();
                            if (text === actions[0].label) {
                                Lampa.Modal.close();
                                try {
                                    // Try open details via Activity
                                    Lampa.Activity.push({
                                        title: card.title,
                                        component: 'full',
                                        id: card.id,
                                        type: card.type
                                    });
                                } catch (e) {
                                    notify('Неможливо відкрити деталі');
                                }
                            } else if (text === actions[1].label) {
                                Lampa.Modal.close();
                                const cats = Store.read();
                                const res = removeItem(cats, card._catName, card.id, card.type);
                                if (!res.ok) return notify('Помилка: ' + (res.reason || ''));
                                Store.write(cats);
                                notify('Видалено з категорії');
                                CategoryViewComponent.open(card._catName);
                            } else if (text === 'Скасувати') {
                                Lampa.Modal.close();
                            }
                        }
                    });
                }
            });
        }

        return { open };
    })();

    // --- Global Add-to-Category modal ---
    function chooseCategoryAndAdd(item) {
        const categories = Store.read();
        if (!categories.length) {
            notify('Спочатку створіть категорію');
            return;
        }
        const html = `
            <div class="selector">
                <div class="simple-text">Виберіть категорію для додавання: <b>${item.title || 'Елемент'}</b></div>
                ${categories.map(c => `<div class="button selector">${c.name}</div>`).join('')}
                <div class="button selector">${'Скасувати'}</div>
            </div>`;
        Lampa.Modal.open({
            title: 'Додати до категорії',
            html,
            onBack: () => Lampa.Modal.close(),
            onSelect: (el) => {
                const catName = el.textContent.trim();
                if (catName === 'Скасувати') {
                    Lampa.Modal.close();
                    return;
                }
                const cats = Store.read();
                const res = addItem(cats, catName, item);
                if (!res.ok) {
                    notify('Помилка: ' + (res.reason || ''));
                } else {
                    Store.write(cats);
                    notify(`Додано до "${catName}"`);
                }
                Lampa.Modal.close();
            }
        });
    }

    // --- Hooks: Try inject "Add to category" into details/context if available ---
    function tryInjectDetailsHook() {
        // If Lampa exposes global listener on item details open
        // We add a button into the header to add current item
        try {
            Lampa.Listener.follow('full', function (e) {
                if (!e || !e.card) return;
                const card = e.card;
                const header = document.querySelector('.activity .head .buttons');
                if (header && !header.querySelector(`.${NS}-add-current-btn`)) {
                    const btn = document.createElement('div');
                    btn.className = `button ${NS}-add-current-btn selector`;
                    btn.textContent = 'В закладку (категорія)';
                    btn.addEventListener('click', () => {
                        chooseCategoryAndAdd(card);
                    });
                    header.appendChild(btn);
                }
            });
        } catch (err) {
            console.log('[CustomBookmarks] details hook not available', err);
        }
    }

    function tryInjectCardContextHook() {
        // Attempt to add context menu action to cards if API exists
        try {
            if (Lampa.ContextMenu && typeof Lampa.ContextMenu.addAction === 'function') {
                Lampa.ContextMenu.addAction({
                    name: 'Додати в категорію',
                    icon: ICON,
                    condition: (card) => !!card, // show for all cards
                    onSelect: (card) => {
                        chooseCategoryAndAdd(card);
                    }
                });
            }
        } catch (err) {
            console.log('[CustomBookmarks] context hook not available', err);
        }
    }

    // --- Plugin register ---
    Lampa.Plugin.add({
        id: NS,
        title: 'Custom Bookmarks',
        icon: ICON,
        onStart: function() {
            // Open categories home component
            Lampa.Controller.add(NS, {
                toggle: function() {
                    CategoriesComponent.open();
                }
            });

            // Add entry into main menu list (Plugins menu already shows plugin cards)
            // Provide quick access via Activity
            Lampa.Activity.push({
                url: `${NS}_entry`,
                title: 'Мої категорії',
                component: 'list',
                items: [{
                    title: 'Відкрити категорії',
                    component: 'call',
                    call: () => CategoriesComponent.open(),
                    icon: ICON
                }],
                onSelect: (card) => {
                    if (card.cal
