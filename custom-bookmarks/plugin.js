(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE = 'custom_bookmarks_folders';

    function load() {
        return Lampa.Storage.get(STORAGE, []);
    }

    function save(data) {
        Lampa.Storage.set(STORAGE, data);
    }

    // Перехоплюємо стандартне меню "Вибране"
    const originalSelect = Lampa.Select.show;

    Lampa.Select.show = function (params) {

        // Це саме те меню, яке відкривається з кнопки ⭐
        if (params && params.items && params.items.length) {

            const card = Lampa.Activity.active()?.card;
            if (!card || !card.id) {
                return originalSelect.apply(this, arguments);
            }

            let folders = load();

            // Додаємо користувацькі папки
            folders.forEach((folder, index) => {
                params.items.push({
                    title: folder.name,
                    custom: true,
                    index: index
                });
            });

            // Кнопка створення папки
            params.items.push({
                title: '+ Створити папку',
                create: true
            });

            const originalOnSelect = params.onSelect;

            params.onSelect = function (item) {

                // Створення папки
                if (item.create) {
                    Lampa.Input.edit({
                        title: 'Назва папки',
                        value: ''
                    }, function (name) {
                        if (!name) return;

                        folders.push({
                            name: name,
                            items: [card]
                        });

                        save(folders);
                    });

                    return;
                }

                // Додавання в кастомну папку
                if (item.custom) {
                    let folder = folders[item.index];
                    folder.items = folder.items || [];

                    if (!folder.items.find(i => i.id === card.id)) {
                        folder.items.push(card);
                        save(folders);
                    }

                    return;
                }

                // Стандартна логіка Lampa
                if (originalOnSelect) {
                    originalOnSelect(item);
                }
            };
        }

        return originalSelect.apply(this, arguments);
    };

})();
