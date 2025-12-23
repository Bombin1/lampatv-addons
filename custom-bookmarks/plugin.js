(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_FOLDERS = 'custom_bookmarks_folders';

    function loadFolders() {
        try {
            return JSON.parse(Lampa.Storage.get(STORAGE_FOLDERS, '[]')) || [];
        } catch (e) {
            return [];
        }
    }

    function saveFolders(folders) {
        try {
            Lampa.Storage.set(STORAGE_FOLDERS, JSON.stringify(folders));
        } catch (e) {
            Lampa.Noty.show('Помилка збереження: ' + e.message);
        }
    }

    function createFolderHtml(folder, idx, folders) {
        const item = $(`
            <div class="category-full__item selector">
                <div class="category-full__name">${folder.name}</div>
                <div class="category-full__count">${(folder.list || []).length} items</div>
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
                items: [
                    { title: 'Видалити папку', action: 'delete' }
                ],
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
                                <div class="category-full__item selector">
                                    <div class="category-full__name">+ Створити папку</div>
                                </div>
                            `);

                            createBtn.on('click', function () {
                                Lampa.Input.edit({
                                    value: '',
                                    title: 'Назва папки'
                                }, function (name) {
                                    if (name) {
                                        folders.push({ name: name, list: [] });
                                        saveFolders(folders);
                                        wrapper.append(createFolderHtml(folders[folders.length - 1], folders.length - 1, folders));
                                        Lampa.Noty.show('Папку "'+name+'" створено');
                                        Lampa.Controller.enable('content');
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

        // модифікація вибору закладок у Select
        const originalSelect = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            if (params.title === Lampa.Lang.translate('title_book')) {
                const movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
                folders = loadFolders();

                folders.forEach((f, i) => {
                    params.items.push({
                        title: f.name,
                        is_custom: true,
                        f_idx: i
                    });
                });

                params.items.push({
                    title: '+ Додати нову папку',
                    is_new: true
                });

                const origOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_new) {
                        Lampa.Input.edit({
                            value: '',
                            title: 'Назва папки'
                        }, function (name) {
                            if (name) {
                                folders.push({ name: name, list: [movie] });
                                saveFolders(folders);
                                Lampa.Noty.show('Створено "'+name+'" та додано фільм');
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

    Lampa.Noty.show('Custom Bookmarks активний');
})();
