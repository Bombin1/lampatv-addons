(function () {
    'use strict';

    if (!window.Lampa) return;

    const PREFIX = 'user_list_';

    function waitBookmarks(cb) {
        if (Lampa.Bookmarks && Lampa.Bookmarks.categories) cb();
        else setTimeout(() => waitBookmarks(cb), 300);
    }

    waitBookmarks(function () {

        function getLists() {
            return Lampa.Bookmarks.categories.filter(c =>
                c.id && c.id.indexOf(PREFIX) === 0
            );
        }

        function createList(title) {
            const id = PREFIX + Date.now();

            Lampa.Bookmarks.categories.push({
                id: id,
                title: title,
                source: 'plugin',
                type: 'custom'
            });

            Lampa.Bookmarks.save();
        }

        function addToList(card, list_id) {
            const data = Lampa.Bookmarks.card(card);
            Lampa.Bookmarks.add(data, list_id);
        }

        /* ===== МЕНЮ "МОЇ" ===== */

        Lampa.Listener.follow('menu', function (e) {
            if (e.type !== 'build') return;
            if (e.name !== 'my') return;

            e.items.unshift({
                title: '+ Створити список',
                type: 'action',
                action: function () {
                    Lampa.Input.show({
                        title: 'Назва списку',
                        value: '',
                        onSubmit: function (v) {
                            if (!v) return;
                            createList(v);
                            Lampa.Activity.replace();
                        }
                    });
                }
            });
        });

        /* ===== КАРТКА ФІЛЬМУ ===== */

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'build') return;

            e.buttons.unshift({
                title: 'В список',
                action: function () {
                    const lists = getLists();

                    if (!lists.length) {
                        Lampa.Noty.show('Створи список');
                        return;
                    }

                    Lampa.Select.show({
                        title: 'Вибери список',
                        items: lists.map(l => ({
                            title: l.title,
                            id: l.id
                        })),
                        onSelect: function (a) {
                            addToList(e.data, a.id);
                            Lampa.Noty.show('Додано');
                        }
                    });
                }
            });
        });

    });

})();
