const CACHE_NAME = 'sw_cache_v1';
let cachelist = ['./app.js', './index.css'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        // cacheStorage API 可直接用caches来替代
        // open方法创建/打开缓存空间，并会返回promise实例
        // then来接收返回的cache对象索引
        caches.open(CACHE_NAME)
         // cache对象addAll方法解析（同fetch）并缓存所有的文件
        .then(function(cache) {
            console.log('Opened cache');
            return cache.addAll(cachelist);
        })
    );
    // 一般注册以后，激活需要等到再次刷新页面后再激活
    // 可防止出现等待的情况，这意味着服务工作线程在安装完后立即激活
    // self.skipWaiting();
})
self.addEventListener('activate', function (event) {
    // 若缓存数据更改，则在这里更新缓存
    var cacheDeletePromise = caches.keys()
    .then(keyList => {
        Promise.all(keyList.map(key => {
            if (key !== CACHE_NAME) {
                var deletePromise = caches.delete(key)
                return deletePromise
            } else {
                Promise.resolve()
            }
        }));
    });
    event.waitUntil(
        Promise.all([cacheDeletePromise]).then(res => {
            this.clients.claim()
        })
    );
});
// self.addEventListener('fetch', function(event) {
//     event.respondWith(
//         caches.match(event.request)
//         .then(function(response) {
//             // Cache hit - return response
//             if (response) {
//             return response;
//             }
//             return fetch(event.request);
//         }
//         )
//     );
// });
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
        .then(function(response) {
            // Cache hit - return response
            if (response) {
                return response;
            }
            // return fetch(event.request);
            var requestClone = event.request.clone();
            return fetch(requestClone).then(response => {
                if(!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                var responseToCache = response.clone();
                caches.open(CACHE_NAME)
                .then(function(cache) {
                    cache.put(event.request, responseToCache);
                });
                return response;
            });
        })
    );
});

// const CACHE_NAME = 'sw_cache_v2';

// self.addEventListener('install', (event) => {
//     event.waitUntil(
//         // cacheStorage API 可直接用caches来替代
//         // open方法创建/打开缓存空间，并会返回promise实例
//         // then来接收返回的cache对象索引
//         caches.open(CACHE_NAME)
//          // cache对象addAll方法解析（同fetch）并缓存所有的文件
//         .then(function(cache) {
//             return cache.add('index_copy.png')
//         })
//     );
//     // 一般注册以后，激活需要等到再次刷新页面后再激活
//     // 可防止出现等待的情况，这意味着服务工作线程在安装完后立即激活
//     self.skipWaiting();
// })
// self.addEventListener('activate', function (event) {
//     // 若缓存数据更改，则在这里更新缓存
//     var cacheDeletePromise = caches.keys()
//     .then(keyList => {
//         Promise.all(keyList.map(key => {
//             if (key !== CACHE_NAME) {
//                 var deletePromise = caches.delete(key)
//                 return deletePromise
//             } else {
//                 Promise.resolve()
//             }
//         }));
//     });
//     event.waitUntil(
//         Promise.all([cacheDeletePromise]).then(res => {
//             this.clients.claim()
//         })
//     );
// });
// self.addEventListener('fetch', function(event) {
//     event.respondWith(
//         caches.match(event.request)
//         .then(function(response) {
//             // Cache hit - return response
//             if (response) {
//             return response;
//             }
//             return fetch(event.request);
//         }
//         )
//     );
// });
// self.addEventListener('fetch', function(event) {
//     event.respondWith(
//         caches.match(event.request)
//         .then(function(response) {
//             // Cache hit - return response
//             if (response) {
//                 return response;
//             }
//             // return fetch(event.request);
//             var requestClone = event.request.clone();
//             return fetch(requestClone).then(response => {
//                 if(!response || response.status !== 200 || response.type !== 'basic') {
//                     return response;
//                 }
//                 var responseToCache = response.clone();
//                 caches.open(CACHE_NAME)
//                 .then(function(cache) {
//                     cache.put(event.request, responseToCache);
//                 });
//                 return response;
//             });
//         })
//     );
// });