// src/storage/IndexedDBManager.js
export class IndexedDBManager {
  constructor() {
    this.dbName = 'NinjaChatDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Profile store
        if (!db.objectStoreNames.contains('profile')) {
          const profileStore = db.createObjectStore('profile', { keyPath: 'id' });
          profileStore.createIndex('username', 'username', { unique: false });
        }

        // Rooms store
        if (!db.objectStoreNames.contains('rooms')) {
          const roomsStore = db.createObjectStore('rooms', { keyPath: 'id' });
          roomsStore.createIndex('name', 'name', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          messagesStore.createIndex('roomId', 'roomId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // DM store
        if (!db.objectStoreNames.contains('dms')) {
          const dmsStore = db.createObjectStore('dms', { keyPath: 'id', autoIncrement: true });
          dmsStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
      };
    });
  }

  async getProfile() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['profile'], 'readonly');
      const store = transaction.objectStore('profile');
      const request = store.get('main');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProfile(profile) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['profile'], 'readwrite');
      const store = transaction.objectStore('profile');
      const request = store.put({ ...profile, id: 'main' });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveRoom(room) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['rooms'], 'readwrite');
      const store = transaction.objectStore('rooms');
      const request = store.put(room);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getRooms() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['rooms'], 'readonly');
      const store = transaction.objectStore('rooms');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessage(message) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.add(message);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(roomId, limit = 100) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('roomId');
      const request = index.getAll(roomId);

      request.onsuccess = () => {
        const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(messages.slice(-limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveDM(dm) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dms'], 'readwrite');
      const store = transaction.objectStore('dms');
      const request = store.add(dm);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDMs(conversationId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dms'], 'readonly');
      const store = transaction.objectStore('dms');
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const dms = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(dms);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
