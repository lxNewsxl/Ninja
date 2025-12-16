// src/index.js
import { App } from './components/App.js';
import { IndexedDBManager } from './storage/IndexedDBManager.js';

class NinjaChat {
  constructor(rootElement) {
    this.root = rootElement;
    this.db = null;
    this.app = null;
  }

  async init() {
    // Initialize IndexedDB
    this.db = new IndexedDBManager();
    await this.db.init();

    // Initialize App
    this.app = new App(this.root, this.db);
    await this.app.render();
  }
}

// Export for module usage
export default NinjaChat;

// Auto-initialize if root element exists
if (typeof window !== 'undefined') {
  window.NinjaChat = NinjaChat;
  
    const root = document.getElementById('ninja-chat-root');
    if (root) {
      const ninja = new NinjaChat(root);
      ninja.init();
    }
}
