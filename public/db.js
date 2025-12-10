let db;
let dbReadyResolve;
const dbReady = new Promise((res) => { dbReadyResolve = res; });
const open = indexedDB.open('lxnewsxl', 13);

open.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore('profiles', { keyPath: 'id', autoIncrement: true });
  db.createObjectStore('spotlights', { keyPath: 'ts' });
};

open.onsuccess = e => {
  db = e.target.result;
  dbReadyResolve(db);
};

open.onerror = e => console.error('DB open error:', e);

export async function loadProfiles() {
  await dbReady;
  return new Promise(res => {
    const tx = db.transaction('profiles');
    const req = tx.objectStore('profiles').getAll();
    req.onsuccess = () => res(req.result);
  });
}

export async function saveProfile(p) {
  await dbReady;
  const tx = db.transaction('profiles', 'readwrite');
  tx.objectStore('profiles').put(p);
  await new Promise(res => { tx.oncomplete = res; });
}
