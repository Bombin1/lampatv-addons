(function () {
    'use strict';

    if (!window.Lampa) return;

    const CATEGORY_PREFIX = 'user_list_';

    /* ================================
       ДОПОМІЖНІ
    ================================ */

    function getUserLists() {
        return Lampa.Bookmarks.categories.filter(c =>
            c.id.startsWith(CATEGORY_PREFIX)
        );
    }

    function createUserList(title) {
        const id = CATEGORY_PREFIX + Date.now();

        Lampa.Bookmarks.categories.push({
            id: id,
            title: title,
            source: 'plugin',
            type: 'custom'
        });

        Lampa.Bookmarks.save();
    }

    function addCardToList(card, category_id) {
        const bookmarkCard = Lampa.Bookmarks.card(card);
        Lampa.Bookmarks.add(bookmarkCard, category_id);
    }

    /* ================================
       МЕНЮ "МОЇ"
    ================================ */

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
                    onSubmit: function (value) {
                        if (!value) return;
                        createUserList(value);
                        Lampa.Activity.replace();
                    }
                });
            }
        });
    });

    /* ================================
       КАРТКА ФІЛЬМУ
    ================================ */

    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'build') return;

        e.buttons.unshift({
            title: 'В список',
            svg: '<svg viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
            action: function () {
                const lists = getUserLists();

                if (!lists.length) {
                    Lampa.Noty.show('Спочатку створи список');
                    return;
                }

                Lampa.Select.show({
                    title: 'Вибери список',
                    items: lists.map(l => ({
                        title: l.title,
                        id: l.id
                    })),
                    onSelect: function (a) {
                        addCardToList(e.data, a.id);
                        Lampa.Noty.show('Додано в "' + a.title + '"');
                    }
                });
            }
        });
    });

})();
