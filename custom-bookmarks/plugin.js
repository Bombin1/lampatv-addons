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
        if (window.Lampa.Cloud && window.Lampa.Account && window.Lampa.Account.logged()) {
            window.Lampa.Cloud.set(STORAGE_KEY, folders);
        }
    }

    // Стилі: Робимо папки схожими на картки фільмів, щоб вони вписалися в скрол
    if (!$('#custom-folders-styles').length) {
        $('body').append('<style id="custom-folders-styles"> \
            .card-folder { width: 140px !important; height: 90px !important; margin: 5px; position: relative; display: inline-block; vertical-align: top; } \
            .card-folder__body { width: 100%; height: 100%; background: rgba(255,255,255,0.05); border-radius: 10px; border: 2px solid transparent; display: flex; flex-direction: column; justify-content: center; align-items: center; transition: all 0.2s; } \
            .card-folder.focus .card-folder__body { background: rgba(255,255,255,0.25) !important; border-color: #fff; transform: scale(1.05); } \
            .card-folder__name { font-size: 12px; color: #fff; text-align: center; margin-top: 5px; padding: 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; } \
            .card-folder__icon { font-size: 24px; } \
        </style>');
    }

    // Компонент перегляду папки
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        this.create = function () {
            this.activity.loader(false);
            (object.items || []).forEach(function (data) {
                var card = new Lampa.Card(data, { card_category: true, is_static: true });
                card.create();
                card.onFocus = function (target) { scroll.update(card.render()); };
                card.onEnter = function () { Lampa.Activity.push({ url: data.url || '', component: 'full', id: data.id, method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb' }); };
                body.append(card.render()); items.push(card);
            });
            scroll.append(body); html.append(scroll.render());
        };
        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () { Lampa.Controller.collectionSet(scroll.render()); Lampa.Controller.collectionFocus(items[0] ? items[0].render() : null); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.render = function () { return html; };
        this.destroy = function () { items.forEach(function (item) { item.destroy(); }); scroll.destroy(); html.remove(); };
    }
    Lampa.Component.add('custom_folder_component', CustomFolderComponent);

    // Функція створення візуальної картки папки
    function createFolderCard(title, icon, onClick, onLongClick) {
        var card = $('<div class="card-folder selector" tabindex="0"><div class="card-folder__body"><div class="card-folder__icon">'+icon+'</div><div class="card-folder__name">'+title+'</div></div></div>');
        card.on('hover:enter', onClick);
        if (onLongClick) card.on('hover:long', onLongClick);
        return card;
    }

    // ПЕРЕХОПЛЕННЯ КОМПОНЕНТА "BOOKMARKS"
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;

                comp.render = function () {
                    var view = originalRender.call(comp);
                    var container = view.find('.category-full').first();
                    
                    if (container.length) {
                        var folders = getFolders();
                        
                        // Додаємо кнопку створення
                        var btnCreate = createFolderCard('Створити', '+', function() {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders(); f.push({ name: name, list: [] });
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        });
                        container.prepend(btnCreate);

                        // Додаємо папки
                        folders.slice().reverse().forEach(function(f, i) {
                            var btnFolder = createFolderCard(f.name, '📁', function() {
                                Lampa.Activity.push({ title: f.name, component: 'custom_folder_component', items: f.list });
                            }, function() {
                                Lampa.Select.show({
                                    title: f.name,
                                    items: [{ title: 'Видалити' }],
                                    onSelect: function() {
                                        var fl = getFolders();
                                        // Знаходимо правильний індекс (бо ми робили reverse)
                                        var realIdx = fl.findIndex(function(folder) { return folder.name === f.name; });
                                        if (realIdx > -1) fl.splice(realIdx, 1);
                                        saveFolders(fl); Lampa.Activity.replace();
                                    }
                                });
                            });
                            container.prepend(btnFolder);
                        });
                    }

                    var originalStart = comp.start;
                    comp.start = function() {
                        // Обов'язково реєструємо view в контролері ПЕРЕД стартом
                        Lampa.Controller.collectionSet(view);
                        originalStart.call(comp);
                        
                        // Примусово фокусуємо першу плитку, якщо вона є
                        var first = view.find('.card-folder').first()[0];
                        if (first) Lampa.Controller.collectionFocus(first);
                    };

                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню вибору в картці фільму (без змін, воно стабільне)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFav = params && params.items && params.items.some(function(i) { return i.id === 'wath' || i.id === 'book' || i.id === 'like'; });
        if (isFav || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;
            if (folders.length > 0 && movie) {
                params.items = params.items.filter(function(i) { return !i.is_custom; });
                folders.forEach(function(f, i) {
                    var exists = (f.list || []).some(function(m) { return m.id == movie.id; });
                    params.items.unshift({ title: f.name, selected: exists, is_custom: true, f_idx: i });
                });
                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpd = getFolders();
                        var target = fUpd[item.f_idx];
                        var mIdx = target.list.findIndex(function(m) { return m.id == movie.id; });
                        if (mIdx > -1) target.list.splice(mIdx, 1);
                        else target.list.push(JSON.parse(JSON.stringify(movie)));
                        saveFolders(fUpd);
                        Lampa.Select.close();
                        setTimeout(function(){ Lampa.Select.show(params); }, 10);
                    } else if (originalOnSelect) { originalOnSelect(item); }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };
})();
