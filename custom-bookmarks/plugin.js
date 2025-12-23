(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_FOLDERS = 'custom_bookmarks_folders';

    // Завантаження та збереження
    function loadFolders() {
        try {
            return JSON.parse(Lampa.Storage.get(STORAGE_FOLDERS, '[]')) || [];
        } catch (e) { return []; }
    }

    function saveFolders(folders) {
        try {
            Lampa.Storage.set(STORAGE_FOLDERS, JSON.stringify(folders));
        } catch (e) { console.log('Помилка збереження'); }
    }

    // Додаємо стилі для тайлів
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append(`<style id="custom-bookmarks-styles">
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 15px 20px; gap: 12px; width: 100%; }
            .folder-tile { 
                background: rgba(255, 255, 255, 0.08); 
                width: 150px; height: 85px; 
                border-radius: 10px; 
                display: flex; flex-direction: column; align-items: center; justify-content: center; 
                cursor: pointer; border: 2px solid transparent; transition: all 0.2s ease;
            }
            .folder-tile.focus { 
                background: #fff !important; color: #000 !important; 
                transform: scale(1.05); border-color: #fff; 
            }
            .folder-tile__name { font-size: 1em; font-weight: 500; text-align: center; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
            .folder-tile__count { font-size: 0.9em; opacity: 0.5; margin-top: 4px; }
            .folder-tile--create { border: 2px dashed rgba(255, 255, 255, 0.2); background: transparent; }
        </style>`);
    }

    // Функція створення тайлу
    function createFolderHtml(folder, idx, folders) {
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
                    folders.splice(idx, 1);
                    saveFolders(folders);
                    Lampa.Activity.replace();
                }
            });
        });

        return item;
    }

    function injectCustomBookmarks() {
        let folders = loadFolders();

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

                            // Тайл "Створити"
                            const createBtn = $(`
                                <div class="folder-tile folder-tile--create selector">
                                    <div class="folder-tile__name">Створити</div>
                                    <div class="folder-tile__count">+</div>
                                </div>
                            `);

                            createBtn.on('click', function () {
                                Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                    if (name) {
                                        folders.push({ name: name, list: [] });
                                        saveFolders(folders);
                                        Lampa.Activity.replace(); // Оновлюємо, щоб з'явився новий тайл
                                    }
                                });
                            });

                            wrapper.append(createBtn);

                            folders.forEach((folder, i) => {
                                wrapper.append(createFolderHtml(folder, i, folders));
                            });

                            container.prepend(wrapper);
                        }
                        return html;
                    };
                    return comp;
                }, true);
            }
        });

        // Модифікація вибору закладок (Select)
        const originalSelect = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            if (params.title === Lampa.Lang.translate('title_book')) {
                const movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
                folders = loadFolders();

                folders.forEach((f, i) => {
                    params.items.push({ title: f.name, is_custom: true, f_idx: i });
                });

                params.items.push({ title: '+ Створити нову папку', is_new: true });

                const origOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_new) {
                        Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                            if (name) {
                                folders.push({ name: name, list: [movie] });
                                saveFolders(folders);
                                Lampa.Noty.show('Папку створено');
                            }
                        });
                    }
                    else if (item.is_custom) {
                        const folder = folders[item.f_idx];
                        folder.list = folder.list || [];
                        if (!folder.list.find(m => m.id == movie.id)) {
                            folder.list.push(movie);
                            saveFolders(folders);
                            Lampa.Noty.show('Додано у ' + folder.name);
                        } else {
                            Lampa.Noty.show('Вже є у цій папці');
                        }
                    } else origOnSelect(item);
                };
            }
            originalSelect.call(Lampa.Select, params);
        };
    }

    injectCustomBookmarks();
})();
