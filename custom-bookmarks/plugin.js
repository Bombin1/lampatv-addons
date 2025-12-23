(function(){
    if (typeof Lampa === 'undefined') return;

    // Реєструємо пункт меню "Закладки"
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
                { title: '✅ Плагін виконався успішно' }
            ]
        });
    });

    console.log('✅ Custom Bookmarks plugin initialized');
})();
