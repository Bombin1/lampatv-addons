(function(){
    if (typeof Lampa === 'undefined') return;

    // Створюємо простий екран
    Lampa.Activity.push({
        url: 'custom_bookmarks_test',
        title: 'Custom Bookmarks',
        component: 'list',
        items: [
            { title: '✅ Плагін виконався успішно' },
            { title: '📦 Версія Lampa: 3.1.2' },
            { title: '🧪 Готово до розширення' }
        ]
    });
})();
