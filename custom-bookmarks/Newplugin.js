(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    function getFolders() {
        try {
            var data = window.localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function saveFolders(folders) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    }

    // Стилі папок, максимально наближені до стокових папок Lampa
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 12px 15px; gap: 10px; width: 100%; } \
            .folder-tile { \
                position: relative; \
                background: rgba(255, 255, 255, 0.1); \
                width: 140px; height: 80px; \
                border-radius: 8px; \
                display: flex; flex-direction: column; align-items: center; justify-content: center; \
                cursor: pointer; transition: all 0.2s ease; \
                overflow: hidden; \
            } \
            .folder-tile.focus { \
                background: #fff !important; \
                color: #000 !important; \
                transform: scale(1.05); \
            } \
            .folder-tile__name { \
                font-size: 0.9em; \
                font-weight: 500; \
                text-align: center; \
                padding: 0 5px; \
                white-space: nowrap; \
                text-overflow: ellipsis; \
                overflow: hidden; \
                width: 100%; \
                z-index: 2; \
            } \
            .folder-tile__count { \
                font-size: 0.7em; \
                opacity: 0.6; \
                margin-top: 4px; \
                z-index: 2; \
            } \
            .folder-tile--create { \
                border: 2px dashed rgba(255, 255, 255, 0.2); \
                background: transparent; \
            } \
            /* Ефект "папки" через фон, як у референсі */ \
            .folder-tile::after { \
                content: ""; \
                position: absolute; \
                bottom: 0; right: 0; \
                width: 40px; height: 40px; \
                background: rgba(255,255,255,0.03); \
                border-radius: 50% 0 0 0; \
            } \
        </style>');
    }

    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;

                comp.render = function () {
                    var html = originalRender.call(comp);
                    var folders = getFolders();
                    var container = html.find('.category-full, .bookmarks-list, .scroll__content').first();
                    
                    if (container.length) {
                        var wrapper = $('<div class="custom-bookmarks-wrapper"></div>');
                        
                        // Кнопка створення
                        var createBtn = $('<div class="folder-tile folder-tile--create selector"><div class="folder-tile__name">Створити</div></div>');
                        createBtn.on('click', function () {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders();
                                    f.push({ name: name, list: [] });
                                    saveFolders(f);
                                    Lampa.Activity.replace();
                                }
                            });
                        });
                        wrapper.append(createBtn);

                        // Список папок
                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector"><div class="folder-tile__name">' + folder.name + '</div><div class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + ' шт.</div></div>');
                            
                            tile.on('click', function() {
                                // РЕАЛІЗАЦІЯ ЯК У РЕФЕРЕНСІ (через method: card)
                                Lampa.Activity.push({
                                    title: folder.name,
                                    component: 'category_full',
                                    method: 'card', // Вказуємо метод рендеру карток
                                    card: folder.list || [], // Передаємо масив сюди
                                    page: 1
                                });
                            });

                            tile.on('hover:long', function() {
                                Lampa.Select.show({
                                    title: folder.name,
                                    items: [
                                        { title: 'Очистити папку', action: 'clear' },
                                        { title: 'Видалити папку', action: 'delete' }
                                    ],
                                    onSelect: function(item) {
                                        var f = getFolders();
                                        if (item.action === 'delete') {
                                            f.splice(i, 1);
                                        } else {
                                            f[i].list = [];
                                        }
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

    // Додавання в папки через меню Select (без змін, працює стабільно)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFavMenu = params && params.items && params.items.some(function(i) { 
            return i.id === 'wath' || i.id === 'book' || i.id === 'like'; 
        });

        if (isFavMenu || (params.title && params.title.indexOf('Вибране') !== -1)) {
            var folders = getFolders();
            var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;

            if (folders.length > 0 && movie) {
                params.items.push({ title: '--- МОЇ ПАПКИ ---', separator: true });
                folders.forEach(function(f, i) {
                    params.items.push({ title: '📁 ' + f.name, is_custom: true, f_idx: i });
                });

                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        
                        // Нормалізація як у референсі
                        var cleanCard = {
                            id: movie.id,
                            title: movie.title || movie.name,
                            original_title: movie.original_title || movie.original_name,
                            release_date: movie.release_date || movie.first_air_date,
                            poster_path: movie.poster_path || movie.poster,
                            img: movie.img || movie.poster_path || movie.poster,
                            type: movie.type || (movie.name ? 'tv' : 'movie'),
                            vote_average: movie.vote_average
                        };
                        
                        if (!target.list.some(function(m) { return m.id == cleanCard.id; })) {
                            target.list.push(cleanCard);
                            saveFolders(fUpdate);
                            Lampa.Noty.show('Додано в: ' + target.name);
                        } else {
                            Lampa.Noty.show('Вже є в цій папці');
                        }
                    } else if (originalOnSelect) {
                        originalOnSelect(item);
                    }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };
})();
