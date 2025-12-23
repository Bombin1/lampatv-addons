(function(){
    if (typeof Lampa === 'undefined') return;

    Lampa.Activity.push({
        url: 'test_plugin',
        title: 'Тестовий плагін',
        component: 'list',
        items: [
            { title: 'Плагін працює ✅' },
            { title: 'Версія Lampa: 3.1.2' }
        ]
    });
})();
