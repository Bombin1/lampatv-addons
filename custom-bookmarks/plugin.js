(function () {
    'use strict';

    function CustomFoldersExtension() {
        var folders = [];
        
        var load = function() {
            try {
                folders = JSON.parse(Lampa.Storage.get('custom_bookmarks_folders', '[]'));
            } catch(e) { folders = []; }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_folders', JSON.stringify(folders));
        };

        load();

        // 1. ПЕРЕХОПЛЮЄМО СТАНДАРТНИЙ КОМПОНЕНТ BOOKMARKS
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                var originalBookmarks = Lampa.Component.get('bookmarks');
                
                Lampa.Component.add('bookmarks', function (object) {
                    var comp = new originalBookmarks(object);
                    var originalRender = comp.render;

                    comp.render = function () {
                        var html = originalRender.call(comp);
                        load();

                        // Шукаємо контейнер для вставки плиток (пробуємо різні варіанти для надійності)
                        var container = html.find('.category-full, .bookmarks-list, .scroll__content').first();
                        
                        if (container.length) {
                            var folder_html = $('<div class="bookmarks-folders-wrapper" style="display: flex; flex-wrap: wrap; padding: 20px; gap: 15px;"></div>');
                            
                            // Плитка "Создать +"
                            var create_btn = $('<div class="bookmarks-folder selector" style="background: rgba(255,255,255,0.1); width: 160px; height: 90px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;"> \
                                <div style="font-size: 1.1em;">Создать</div><div style="font-size: 1.4em; font-weight: bold;">+</div> \
                            </div>');

                            create_btn.on('click', function() {
                                Lampa.Input.edit({value: '', title: 'Назва папки'}, function(name) {
                                    if (name) {
                                        folders.push({name: name, list: []});
                                        save();
                                        Lampa.Activity.replace();
                                    }
                                });
                            });

                            folder_html.append(create_btn);

                            // Плитки папок
                            folders.forEach(function(folder, index) {
                                var item = $('<div class="bookmarks-folder selector" style="background: rgba(255,255,255,0.1); width: 160px; height: 90px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;"> \
                                    <div style="font-size: 1.1em; text-align: center; padding: 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">'+folder.name+'</div> \
                                    <div style="font-size: 1.3em; opacity: 0.5;">'+folder.list.length+'</div> \
                                </div>');

                                item.on('click', function() {
                                    Lampa.Activity.push({
                                        title: folder.name,
                                        component: 'category_full',
                                        card: folder.list,
                                        page: 1
                                    });
                                });

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

                            container.prepend(folder_html);
                        }
                        return html;
                    };
                    return comp;
                }, true); // true дозволяє перезаписати існуючий компонент
            }
        });

        // 2. МОДИФІКАЦІЯ МЕНЮ "ВИБРАНЕ" У КАРТЦІ
        var originalSelect = Lampa.Select.show;
        Lampa.Select.show = function(params) {
            if (params.title === Lampa.Lang.translate('title_book')) {
                load();
                folders.forEach(function(f, i) {
                    params.items.push({ title: f.name, is_custom: true, f_idx: i });
                });
                params.items.push({ title: ' + Нова папка', is_new: true });

                var originalOnSelect = params.onSelect;
                params.onSelect = function(item) {
                    var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
                    if (item.is_new) {
                        Lampa.Input.edit({value: '', title: 'Назва'}, function(name){
                            if(name) { folders.push({name: name, list: [movie]}); save(); Lampa.Noty.show('Створено'); }
                        });
                    } else if (item.is_custom) {
                        var folder = folders[item.f_idx];
                        if (!folder.list.find(function(m){return m.id == movie.id})) {
                            folder.list.push(movie); save(); Lampa.Noty.show('Додано в ' + folder.name);
                        }
                    } else originalOnSelect(item);
                };
            }
            originalSelect.call(Lampa.Select, params);
        };
    }

    CustomFoldersExtension();
})();
