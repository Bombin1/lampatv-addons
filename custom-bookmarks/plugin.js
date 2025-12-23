(function () {
    'use strict';

    if (!window.Lampa) return;

    console.log('[MyBookmarks] loaded');

    /**
     * Додавання у стандартне Вибране Lampa
     */
    function addToFavorite(card) {
        if (!card || !card.id) {
            Lampa.Noty.show('Неможливо додати');
            return;
        }

        // перевірка, чи вже є у вибраному
        if (Lampa.Favorite.check(card)) {
            Lampa.Noty.show('Вже у вибраному');
            return;
        }

        Lampa.Favorite.add(card);
        Lampa.Noty.show('Додано у вибране');
    }

    /**
     * Додаємо кнопку у картці фільму / серіалу
     */
    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'open') return;

        let render = e.object.activity.render();
        if (!render || !render.length) return;

        // щоб не дублювати кнопку
        if (render.find('.my-bookmarks-btn').length) return;

        let button = $('<div class="full__button selector my-bookmarks-btn">У вибране</div>');

        button.on('click', function () {
            addToFavorite(e.object.card);
        });

        render.find('.full__buttons').append(button);
    });

    /**
     * Інформаційне повідомлення
     */
    Lampa.Noty.show('MyBookmarks активний');

})();
