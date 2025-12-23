function () {
    'use strict';

    // Додаємо пункт меню "Закладки"
    Lampa.Menu.add({
        id: 'custom_bookmarks',
        title: 'Закладки'
    }, function(){
        // Відкриваємо екран із тестовим списком
        Lampa.Activity.push({
            url: 'custom_bookmarks',
            title: 'Закладки',
            component: 'list',
            items: [
                { title: '📌 Тут будуть ваші закладки' },
                { title: '✅ Плагін працює у форматі nc.js' }
            ]
        });
    });

    console.log('✅ Custom Bookmarks plugin initialized');
}
