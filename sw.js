// sw.js - Service Worker para TENDEX (CORRIGIDO)
const CACHE_NAME = 'tendex-v1';
const MODELOS_CACHE = 'tendex-modelos';

const urlsToCache = [
  '/TENDEX/',
  '/TENDEX/dashboard.html',
  '/TENDEX/index.html'
];

// URLs que NÃO devem ser interceptadas
const EXCLUDED_URLS = [
  'supabase.co',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'github.io'
];

function isExcluded(url) {
  return EXCLUDED_URLS.some(excluded => url.includes(excluded));
}

self.addEventListener('install', event => {
  console.log('Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache principal aberto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Erro ao adicionar ao cache:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker ativado');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME && cache !== MODELOS_CACHE) {
              console.log('Removendo cache antigo:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // NÃO interceptar requisições excluídas
  if (isExcluded(url.href)) {
    return;
  }
  
  // Ignorar requisições que não são GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Fallback para offline
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/TENDEX/offline.html');
          }
          return new Response('Recurso não disponível offline', { status: 503 });
        });
      })
  );
});

self.addEventListener('sync', event => {
  console.log('Evento sync recebido:', event.tag);
  if (event.tag === 'sync-inspecoes') {
    event.waitUntil(sincronizarDados());
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function sincronizarDados() {
  console.log('🔄 Sincronizando dados pendentes...');
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_TRIGGERED',
        message: 'Internet restaurada. Iniciando sincronização...',
        timestamp: new Date().toISOString()
      });
    });
    console.log('✅ Sincronização finalizada');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  }
}
