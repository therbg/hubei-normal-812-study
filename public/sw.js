const CACHE_NAME = "hbnu-812-offline-v1";
const BASE_URL = new URL("./", self.location.href);
const INDEX_URL = new URL("index.html", BASE_URL);

function assetUrlsFromHtml(html) {
  const urls = [];
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(attributePattern)) {
    const value = match[1];
    if (!value || value.startsWith("data:") || value.startsWith("#")) continue;

    const url = new URL(value, BASE_URL);
    if (url.origin === self.location.origin) urls.push(url.toString());
  }

  return [...new Set(urls)];
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(BASE_URL.toString(), { cache: "reload" });

  if (!response.ok) {
    throw new Error(`Unable to cache app shell: ${response.status}`);
  }

  const html = await response.clone().text();
  await cache.put(BASE_URL.toString(), response.clone());
  await cache.put(INDEX_URL.toString(), response.clone());

  await Promise.all(
    assetUrlsFromHtml(html).map(async (url) => {
      const assetResponse = await fetch(url, { cache: "reload" });
      if (!assetResponse.ok) {
        throw new Error(`Unable to cache asset: ${url}`);
      }
      await cache.put(url, assetResponse);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("hbnu-812-offline-") && key !== CACHE_NAME)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE_URL.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
            return response;
          }

          return (
            (await caches.match(INDEX_URL.toString())) ||
            (await caches.match(BASE_URL.toString())) ||
            response
          );
        })
        .catch(async () => {
          return (
            (await caches.match(request, { ignoreSearch: true })) ||
            (await caches.match(INDEX_URL.toString())) ||
            (await caches.match(BASE_URL.toString())) ||
            Response.error()
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      });
    }),
  );
});
