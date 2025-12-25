(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_KEY = 'custom_bookmarks_folders';

    function getFolders() {
        try {
            let data = window.localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveFolders(folders) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    }

    // ======= Відображення папок у загальній закладці =======
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            const originalBookmarks = Lampa.Component.get('bookmarks');

            Lampa.Component.add('bookmarks', function (object) {
                const comp = new originalBookmarks(object);
                const originalRender = comp.render;

                comp.render = function () {
                    const html = originalRender.call(comp);
                    const folders = getFolders();
                    const container = html.find('.category-full, .bookmarks-list, .scroll__content').first();

                    if (container.length) {

                        const wrapper = $('<div class="category-full"></div>');

                        const createBtn = $('<div class="category-full__item selector"><div class="category-full__name">+ Створити папку</div></div>');

                        createBtn.on('click', function () {
                            Lampa.Input.edit({
                                value: '',
                                title: 'Назва папки'
                            }, function (name) {
                                if (name) {
                                    const f = getFolders();
                                    f.push({ name: name, list: [] });
                                    saveFolders(f);
                                    Lampa.Activity.replace(); // перерендерити
                                }
                            });
                        });

                        wrapper.append(createBtn);

                        folders.forEach(function (folder, i) {
                            const tile = $(
                                '<div class="category-full__item selector">' +
                                '<div class="category-full__name">' + folder.name + '</div>' +
                                '<div class="category-full__count">' + (folder.list ? folder.list.length : 0) + ' items</div>' +
                                '</div>'
                            );

                            tile.on('click', function () {
                                Lampa.Activity.push({
                                    title: folder.name,
                                    component: 'custom_folder',
                                    data: {
                                        title: folder.name,
                                        list: folder.list || []
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

    // ======= Компонент для відображення папки =======
    Lampa.Component.add('custom_folder', {
        template: function () {
            return '<div class="items grid"></div>'; // сітка карток
        },
        onCreate: function () {
            const list = this.data.list || [];

            // перетворюємо дані у повні карти
            const items = list.map(item => {
                return {
                    id: item.id,
                    title: item.title,
                    original_title: item.original_title,
                    release_date: item.release_date,
                    poster: item.img,
                    type: item.type
                };
            });

            Lampa.Template.get('items').render(items, this.el.find('.items'));
        }
    });

    // ======= Додавання з картки фільму =======
    const originalSelectShow = Lampa.Select.show;

    Lampa.Select.show = function (params) {

        const isFav = params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1);

        if (isFav && params.items) {
            const folders = getFolders();
            const active = Lampa.Activity.active();
            const movie = active.card || active.data;

            if (folders.length > 0 && movie) {
                params.items.push({ title: '--- МОЇ ПАПКИ ---', separator: true });

                folders.forEach(function (f, i) {
                    params.items.push({
                        title: f.name,
                        is_custom: true,
                        f_idx: i
                    });
                });

                const originalOnSelect = params.onSelect;

                params.onSelect = function (item) {
                    if (item.is_custom) {
                        const fUpdate = getFolders();
                        const target = fUpdate[item.f_idx];
                        if (!target.list) target.list = [];

                        const cleanCard = {
                            id: movie.id,
                            title: movie.title || movie.name,
                            original_title: movie.original_title || movie.original_name,
                            release_date: movie.release_date || movie.first_air_date,
                            img: movie.img || movie.poster || movie.poster_path,
                            type: movie.type || (movie.name ? 'tv' : 'movie')
                        };

                        if (!target.list.some(m => m.id == cleanCard.id)) {
                            target.list.push(cleanCard);
                            saveFolders(fUpdate);

                            Lampa.Noty.show('Додано в: ' + target.name);

                            // **оновлюємо UI у бекграунді**
                            Lampa.Activity.back(); // повертаємось з меню
                            Lampa.Activity.replace(); // перерендер контенту
                        } else {
                            Lampa.Noty.show('Вже є в цій папці');
                        }
                    } else if (originalOnSelect) {
                        originalOnSelect(item);
                    }
                };
            }
        }

        return originalSelectShow.call(Lampa.Select, params);
    };

})();
