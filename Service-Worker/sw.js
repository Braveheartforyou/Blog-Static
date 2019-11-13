const CACHE_NAME = 'sw_cache_v1';
let cachelist = ['./index/app.js', './index/index.css'];

self.addEventListener('install', (installEvent) => {
    installEvent.waitUntill(
        // cacheStorage API 可直接用caches来替代
        // open方法创建/打开缓存空间，并会返回promise实例
        // then来接收返回的cache对象索引
        caches.open(CACHE_NAME)
         // cache对象addAll方法解析（同fetch）并缓存所有的文件
        .then(function(cache) {
            console.log('Opened cache');
            return cache.addAll(cacheUrlList);
        })
    );
})