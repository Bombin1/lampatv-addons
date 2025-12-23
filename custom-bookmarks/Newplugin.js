(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_KEY = 'custom_bookmarks_folders';

    function getFolders() {
        try {
            return JSON.parse(Lampa.Storage.get(STORAGE_KEY, '[]')) || [];
        } catch (e) { return []; }
    }

    function saveFolders(folders) {
        Lampa.Storage.set(STORAGE_KEY, JSON.stringify(folders));
    }

    // Стилі для тайлів
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

    // 1. ВІДОБРАЖЕННЯ В РОЗДІЛІ ЗАКЛАДОК
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
                        const folders = getFolders();

                        const createBtn = $(`
                            <div class="folder-tile folder-tile--create selector">
                                <div class="folder-tile__name">Створити</div>
                                <div class="folder-tile__count">+</div>
                            </div>
                        `);

                        createBtn.on('click', function () {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    let f = getFolders();
                                    f.push({ name: name, list: [] });
                                    saveFolders(f);
                                    Lampa.Activity.replace();
                                }
                            });
                        });

                        wrapper.append(createBtn);
                        folders.forEach((folder, i) => {
                            const tile = $(`
                                <div class="folder-tile selector">
                                    <div class="folder-tile__name">${folder.name}</div>
                                    <div class="folder-tile__count">${folder.list.length} шт.</div>
                                </div>
                            `);
                            tile.on('click', () => {
                                Lampa.Activity.push({ title: folder.name, component: 'category_full', card: folder.list, page: 1 });
                            });
                            tile.on('hover:long', () => {
                                Lampa.Select.show({
                                    title: folder.name,
                                    items: [{ title: 'Видалити папку' }],
                                    onSelect: () => {
                                        let f = getFolders();
                                        f.splice(i, 1);
                                        saveFolders(f);
                                        Lampa.Activity.replace();
                                    }
                                });
                            });
                            wrapper.append(tile);
                        });
                        container.prepend(wrapper);
                    }
                    return html;
                };
                return comp;
            }, true);
        }
    });

    // 2. ІНТЕГРАЦІЯ В МЕНЮ "ВИБРАНЕ" (ПЕРЕПИСАНО)
    const originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        // Перевіряємо, чи це меню додавання в закладки
        if (params.title === Lampa.Lang.translate('title_book') || (params.items && params.items.some(i => i.id === 'wath'))) {
            const movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
            const folders = getFolders();

            if (folders.length > 0) {
                // Створюємо новий масив пунктів, щоб Lampa точно його побачила
                let newItems = [];
                
                // Додаємо власні папки на початок списку (щоб відразу бачити)
                folders.forEach((f, i) => {
                    newItems.push({
                        title: '📁 ' + f.name,
                        custom_folder_idx: i
                    });
                });

                newItems.push({ title: '', separator: true }); // Розділювач

                // Додаємо всі стандартні пункти, які вже були в params.items
                params.items.forEach(item => {
                    newItems.push(item);
                });

                // Замінюємо старі пункти на наші нові
                params.items = newItems;

                // Перехоплюємо вибір
                const originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (typeof item.custom_folder_idx !== 'undefined') {
                        let fUpdate = getFolders();
                        let target = fUpdate[item.custom_folder_idx];
                        if (!target.list.find(m => m.id == movie.id)) {
                            target.list.push(movie);
                            saveFolders(fUpdate);
                            Lampa.Noty.show('Додано в: ' + target.name);
                        } else {
                            Lampa.Noty.show('Вже є в цій папці');
                        }
                    } else {
                        originalOnSelect(item);
                    }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };

})();
