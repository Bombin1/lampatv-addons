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
            try {
                Lampa.Storage.set('custom_bookmarks_folders', JSON.stringify(folders));
            } catch(e) {
                Lampa.Noty.show('Помилка збереження: ' + e.message);
            }
        };

        load();

        // Функція створення плитки папки
        var createFolderHtml = function(folder, index) {
            var item = $('<div class="bookmarks-folder selector" style="background: rgba(255,255,255,0.1); width: 160px; height: 90px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; margin-right: 15px; margin-bottom: 15px;"> \
                <div style="font-size: 1.1em; text-align: center; padding: 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">'+folder.name+'</div> \
                <div style="font-size: 1.3em; opacity: 0.5;">'+(folder.list ? folder.list.length : 0)+'</div> \
            </div>');

            item.on('click', function() {
                Lampa.Activity.push({
                    title: folder.name,
                    component: 'category_full',
                    card: folder.list || [],
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
            return item;
        };

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

                        var container = html.find('.category-full, .bookmarks-list, .scroll__content').first();
                        
                        if (container.length) {
                            var wrapper = $('<div class="bookmarks-folders-wrapper" style="display: flex; flex-wrap: wrap; padding: 20px; width: 100%;"></div>');
                            
                            // Плитка "Створити +"
                            var create_btn = $('<div class="bookmarks-folder selector" style="background: rgba(255,255,255,0.1); width: 160px; height: 90px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; margin-right: 15px; margin-bottom: 15px; border: 2px dashed rgba(255,255,255,0.2);"> \
                                <div style="font-size: 1.1em;">Створити</div><div style="font-size: 1.4em; font-weight: bold;">+</div> \
                            </div>');

                            create_btn.on('click', function() {
                                Lampa.Input.edit({value: '', title: 'Назва папки'}, function(name) {
                                    if (name) {
                                        var newFolder = {name: name, list: []};
                                        folders.push(newFolder);
                                        save();
                                        // Оновлюємо інтерфейс негайно
                                        wrapper.append(createFolderHtml(newFolder, folders.length - 1));
                                        Lampa.Noty.show('Папку "' + name + '" створено');
                                        Lampa.Controller.enable('content');
                                    }
                                });
                            });

                            wrapper.append(create_btn);

                            // Додаємо існуючі папки
                            folders.forEach(function(folder, index) {
                                wrapper.append(createFolderHtml(folder, index));
                            });

                            container.prepend(wrapper);
                        }
                        return html;
                    };
                    return comp;
                }, true);
            }
        });

        // 2. МОДИФІКАЦІЯ МЕНЮ ЗАКЛАДОК У КАРТЦІ
        var originalSelect = Lampa.Select.show;
        Lampa.Select.show = function(params) {
            if (params.title === Lampa.Lang.translate('title_book')) {
                load();
                folders.forEach(function(f, i) {
                    params.items.push({ title: f.name, is_custom: true, f_idx: i });
                });
                params.items.push({ title: ' + Створити папку', is_new: true });

                var originalOnSelect = params.onSelect;
                params.onSelect = function(item) {
                    var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
                    if (item.is_new) {
                        Lampa.Input.edit({value: '', title: 'Назва папки'}, function(name){
                            if(name) { 
                                folders.push({name: name, list: [movie]}); 
                                save(); 
                                Lampa.Noty.show('Створено та додано'); 
                            }
                        });
                    } else if (item.is_custom) {
                        var folder = folders[item.f_idx];
                        if (!folder.list) folder.list = [];
                        if (!folder.list.find(function(m){return m.id == movie.id})) {
                            folder.list.push(movie); 
                            save(); 
                            Lampa.Noty.show('Додано в ' + folder.name); 
                        } else {
                            Lampa.Noty.show('Вже є в цій папці');
                        }
                    } else originalOnSelect(item);
                };
            }
            originalSelect.call(Lampa.Select, params);
        };
    }

    CustomFoldersExtension();
})();
