(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_FOLDERS = 'custom_bookmarks_folders';

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

    // Стилі для дуже маленьких тайлів (зменшено на 1/3)
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
                                        Lampa.Activity.replace();
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

        // МОДИФІКАЦІЯ МЕНЮ "ВИБРАНЕ" (Select)
        const originalSelect = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            // Шукаємо меню "Вибране" за всіма можливими заголовками
            const isFavoriteMenu = params.title === 'Вибране' || 
                                 params.title === 'Избранное' || 
                                 params.title === Lampa.Lang.translate('title_book') ||
                                 params.items.some(i => i.id === 'wath' || i.id === 'book');

            if (isFavoriteMenu) {
                const movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
                folders = loadFolders();

                // Додаємо роздільник, якщо є папки
                if (folders.length > 0) {
                    params.items.push({ title: '--- МОЇ ПАПКИ ---', separator: true });
                }

                folders.forEach((f, i) => {
                    params.items.push({
                        title: f.name,
                        is_custom_folder: true,
                        folder_index: i,
                        ghost: true // Дозволяє виділяти пункт без закриття, якщо потрібно
                    });
                });

                const origOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom_folder) {
                        const folder = folders[item.folder_index];
                        folder.list = folder.list || [];
                        
                        if (!folder.list.find(m => m.id == movie.id)) {
                            folder.list.push(movie);
                            saveFolders(folders);
                            Lampa.Noty.show('Додано у папку: ' + folder.name);
                        } else {
                            Lampa.Noty.show('Вже є у цій папці');
                        }
                    } else if (!item.separator) {
                        origOnSelect(item);
                    }
                };
            }
            originalSelect.call(Lampa.Select, params);
        };
    }

    injectCustomBookmarks();
})();
