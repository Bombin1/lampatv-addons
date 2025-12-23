(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_FOLDERS = 'custom_bookmarks_folders';

    // Окремі функції для роботи з пам'яттю
    function getStoredFolders() {
        try {
            const data = Lampa.Storage.get(STORAGE_FOLDERS, '[]');
            return JSON.parse(data || '[]');
        } catch (e) { 
            console.log('Error loading folders:', e);
            return []; 
        }
    }

    function saveStoredFolders(folders) {
        try {
            Lampa.Storage.set(STORAGE_FOLDERS, JSON.stringify(folders));
        } catch (e) { 
            Lampa.Noty.show('Помилка збереження');
        }
    }

    // Стилі (без змін, маленькі тайли)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append(`<style id="custom-bookmarks-styles">
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 20px; gap: 8px; width: 100%; }
            .folder-tile { 
                background: rgba(255, 255, 255, 0.08); 
                width: 90px; height: 55px; 
                border-radius: 6px; 
                display: flex; flex-direction: column; align-items: center; justify-content: center; 
                cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease;
            }
            .folder-tile.focus { 
                background: #fff !important; color: #000 !important; 
                transform: scale(1.05); border-color: #fff; 
            }
            .folder-tile__name { font-size: 0.75em; font-weight: 500; text-align: center; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
            .folder-tile__count { font-size: 0.7em; opacity: 0.5; margin-top: 1px; }
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.2); background: transparent; }
        </style>`);
    }

    function createFolderTile(folder, idx) {
        const item = $(`
            <div class="folder-tile selector">
                <div class="folder-tile__name">${folder.name}</div>
                <div class="folder-tile__count">${(folder.list || []).length} шт.</div>
            </div>
        `);

        item.on('click', function () {
            Lampa.Activity.push({
                title: folder.name,
                component: 'category_full',
                card: folder.list || [],
                page: 1
            });
        });

        item.on('hover:long', function () {
            Lampa.Select.show({
                title: folder.name,
                items: [{ title: 'Видалити папку', action: 'delete' }],
                onSelect: function () {
                    let folders = getStoredFolders();
                    folders.splice(idx, 1);
                    saveStoredFolders(folders);
                    Lampa.Activity.replace();
                }
            });
        });

        return item;
    }

    function init() {
        // 1. Інтеграція в розділ "Вибране" бокової панелі
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                const originalBookmarks = Lampa.Component.get('bookmarks');
                Lampa.Component.add('bookmarks', function (object) {
                    const comp = new originalBookmarks(object);
                    const originalRender = comp.render;

                    comp.render = function () {
                        const html = originalRender.call(comp);
                        const container = html.find('.category-full, .bookmarks-list, .scroll__content').first();
                        
                        if (container.length) {
                            const wrapper = $('<div class="custom-bookmarks-wrapper"></div>');
                            const folders = getStoredFolders();

                            const createBtn = $(`
                                <div class="folder-tile folder-tile--create selector">
                                    <div class="folder-tile__name">Створити</div>
                                    <div class="folder-tile__count">+</div>
                                </div>
                            `);

                            createBtn.on('click', function () {
                                Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                    if (name) {
                                        let currentFolders = getStoredFolders();
                                        currentFolders.push({ name: name, list: [] });
                                        saveStoredFolders(currentFolders);
                                        Lampa.Activity.replace();
                                    }
                                });
                            });

                            wrapper.append(createBtn);
                            folders.forEach((folder, i) => {
                                wrapper.append(createFolderTile(folder, i));
                            });

                            container.prepend(wrapper);
                        }
                        return html;
                    };
                    return comp;
                }, true);
            }
        });

        // 2. МОДИФІКАЦІЯ МЕНЮ В КАРТЦІ ФІЛЬМУ
        const originalSelect = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            // Перевірка чи це саме те меню
            const isFav = params.title === Lampa.Lang.translate('title_book') || 
                          params.items.some(i => i.id === 'wath' || i.id === 'book');

            if (isFav) {
                // ПРИМУСОВО вантажимо актуальні папки перед показом меню
                const currentFolders = getStoredFolders();
                const movie = Lampa.Activity.active().card || Lampa.Activity.active().data;

                if (currentFolders.length > 0) {
                    // Додаємо розділювач для візуального відокремлення
                    params.items.push({ title: '--- МОЇ ПАПКИ ---', separator: true });

                    currentFolders.forEach((f, i) => {
                        params.items.push({
                            title: f.name,
                            is_custom: true,
                            f_idx: i
                        });
                    });
                }

                const origOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        // Ще раз вантажимо, щоб не затерти зміни, якщо вони були в іншій вкладці
                        let foldersToUpdate = getStoredFolders();
                        const folder = foldersToUpdate[item.f_idx];
                        
                        if (!folder.list) folder.list = [];
                        
                        if (!folder.list.find(m => m.id == movie.id)) {
                            folder.list.push(movie);
                            saveStoredFolders(foldersToUpdate);
                            Lampa.Noty.show('Додано у "' + folder.name + '"');
                        } else {
                            Lampa.Noty.show('Вже є у цій папці');
                        }
                    } else if (origOnSelect && !item.separator) {
                        origOnSelect(item);
                    }
                };
            }
            originalSelect.call(Lampa.Select, params);
        };
    }

    init();
})();
