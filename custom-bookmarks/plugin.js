(function(){
    if (typeof Lampa === 'undefined') return;

    const NS = 'custom_bookmarks';

    // Додаємо пункт у головне меню
    Lampa.Menu.add({
        name: NS,
        title: 'Мої категорії',
        icon: 'bookmark',
        onSelect: function(){
            // Тут відкриваємо простий список
            Lampa.Activity.push({
                url: NS + '_home',
                title: 'Мої категорії',
                component: 'list',
                items: [
                    { title: 'Тестовий елемент 1' },
                    { title: 'Тестовий елемент 2' }
                ]
            });
        }
    });
})();
