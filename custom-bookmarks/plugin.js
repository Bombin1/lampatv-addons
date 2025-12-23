(function () {
    'use strict';

    function CustomBookmarksExtension() {
        var folders = [];
        
        var load = function() {
            try {
                folders = JSON.parse(Lampa.Storage.get('custom_bookmarks_folders', '[]'));
            } catch(e) { 
                folders = []; 
            }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_folders', JSON.stringify(folders));
        };

        load();

        // 1. ПЕРЕХОПЛЕННЯ МЕНЮ ДОДАВАННЯ (Select)
        var originalSelectShow = Lampa.Select.show;
        Lampa.Select.show = function(params) {
            if (params.title === Lampa.Lang.translate('title_book')) {
                // Додаємо власні папки у список вибору
                folders.forEach(function(folder, index) {
                    params.items.push({
                        title: folder.name,
                        custom_folder: true,
                        folder_index: index
                    });
                });

                // Пункт створення нової папки
                params.items.push({
                    title: Lampa.Lang.translate('settings_input_add') + '...',
                    custom_create: true
                });

                var originalOnSelect = params.onSelect;
                params.onSelect = function(item) {
                    var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;

                    if (item.custom_create) {
                        Lampa.Input.edit({value: '', title: Lampa.Lang.translate('settings_input_add')}, function (name) {
                            if (name) {
                                folders.push({ name: name, list: [movie] });
                                save();
                                Lampa.Noty.show(Lampa.Lang.translate('plugins_install_success'));
                            }
                        });
                    } else if (item.custom_folder) {
                        var f = folders[item.folder_index];
                        if (!f.list.find(function(m){ return m.id == movie.id })) {
                            f.list.push(movie);
                            save();
                            Lampa.Noty.show(Lampa.Lang.translate('success'));
                        }
                    } else {
                        originalOnSelect(item);
                    }
                };
            }
            originalSelectShow.call(Lampa.Select, params);
        };

        // 2. ВІДОБРАЖЕННЯ ПЛИТОК У РОЗДІЛІ «ЗАКЛАДКИ»
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' && e.component === 'bookmarks') {
                var render = e.object.render();
                var container = render.find('.category-full'); // Основний контейнер закладок
                
                // Створюємо плитку "Створити +"
                var create_btn = $('<div class="bookmarks-folder selector"> \
                    <div class="bookmarks-folder__title">Создать</div> \
                    <div class="bookmarks-folder__count">+</div> \
                </div>');

                create_btn.on('click', function() {
                    Lampa.Input.edit({value: '', title: 'Назва папки'}, function(name) {
                        if (name) {
                            folders.push({name: name, list: []});
                            save();
                            Lampa.Activity.replace(); // Перемалювати екран
                        }
                    });
                });

                // Додаємо плитки ваших папок
                var folder_html = $('<div class="bookmarks-folders" style="display: flex; padding: 20px 0;"></div>');
                folder_html.append(create_btn);

                folders.forEach(function(folder, index) {
                    var item = $('<div class="bookmarks-folder selector"> \
                        <div class="bookmarks-folder__title">'+folder.name+'</div> \
                        <div class="bookmarks-folder__count">'+folder.list.length+'</div> \
                    </div>');

                    item.on('click', function() {
                        // При кліку на папку показуємо фільми в ній
                        Lampa.Activity.push({
                            title: folder.name,
                            component: 'category_full',
                            card: folder.list,
                            page: 1
                        });
                    });

                    // Видалення папки довгим натисканням
                    item.on('hover:long', function() {
                        Lampa.Select.show({
                            title: folder.name,
                            items: [{title: 'Видалити папку', action: 'delete'}],
                            onSelect: function() {
                                folders.splice(index, 1);
                                save();
                                Lampa.Activity.replace();
                            }
                        });
                    });

                    folder_html.append(item);
                });

                // Вставляємо блок з папками на початок
                container.prepend(folder_html);
                Lampa.Controller.enable('content');
            }
        });

        // Додаємо трохи стилів, щоб плитки виглядали як на скріншоті
        var style = $('<style> \
            .bookmarks-folder { background: rgba(255, 255, 255, 0.1); width: 150px; height: 100px; border-radius: 15px; margin-right: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; } \
            .bookmarks-folder.focus { background: #fff; color: #000; } \
            .bookmarks-folder__title { font-size: 1.2em; margin-bottom: 5px; } \
            .bookmarks-folder__count { font-size: 1.5em; font-weight: bold; opacity: 0.6; } \
        </style>');
        $('body').append(style);
    }

    if (window.appready) CustomBookmarksExtension();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') CustomBookmarksExtension(); });
})();
