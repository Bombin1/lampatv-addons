(function () {
    'use strict';

    if (!window.Lampa || !Lampa.Favorite) return;

    const STORAGE = 'custom_bookmarks_folders';

    function load() {
        return Lampa.Storage.get(STORAGE, []);
    }

    function save(data) {
        Lampa.Storage.set(STORAGE, data);
    }

    // зберігаємо оригінальний метод
    const originalSelect = Lampa.Favorite.select;

    Lampa.Favorite.select = function (card, callback) {

        let folders = load();

        // викликаємо оригінальний select
        originalSelect.call(this, card, function (selected) {

            // якщо вибрано стандартне — передаємо далі
            if (!selected || !selected.custom) {
                if (callback) callback(selected);
                return;
            }

            // створення папки
            if (selected.create) {
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

            // додавання в існуючу папку
            let folder = folders[selected.index];
            folder.items = folder.items || [];

            if (!folder.items.find(i => i.id === card.id)) {
                folder.items.push(card);
                save(folders);
            }
        });

        // доповнюємо UI (після ініціалізації)
        setTimeout(() => {
            let items = this.items || [];

            // додаємо папки
            folders.forEach((folder, index) => {
                items.push({
                    title: folder.name,
                    custom: true,
                    index: index
                });
            });

            // кнопка створення
            items.push({
                title: '+ Створити папку',
                create: true
            });

        }, 0);
    };

})();
