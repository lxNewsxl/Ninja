// src/components/SettingsSidebar.js
export class SettingsSidebar {
  constructor(profile, onClose, onUpdateProfile) {
    this.profile = profile;
    this.onClose = onClose;
    this.onUpdateProfile = onUpdateProfile;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end';
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.onClose();
      }
    };

    const sidebar = document.createElement('div');
    sidebar.className = 'w-96 bg-gray-800 h-full shadow-2xl flex flex-col';
    sidebar.onclick = (e) => e.stopPropagation();

    // Header
    const header = document.createElement('div');
    header.className = 'px-6 py-4 border-b border-gray-700 flex justify-between items-center';

    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold text-purple-400';
    title.textContent = 'Settings';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-gray-400 hover:text-white transition';
    closeBtn.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
    closeBtn.onclick = () => this.onClose();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = document.createElement('div');
    content.className = 'flex-1 overflow-y-auto p-6 space-y-6';

    // Profile section
    const profileSection = this.renderProfileSection();
    
    // About section
    const aboutSection = this.renderAboutSection();

    content.appendChild(profileSection);
    content.appendChild(aboutSection);

    sidebar.appendChild(header);
    sidebar.appendChild(content);
    overlay.appendChild(sidebar);

    return overlay;
  }

  renderProfileSection() {
    const section = document.createElement('div');
    section.className = 'space-y-4';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'text-lg font-semibold text-gray-200 mb-4';
    sectionTitle.textContent = 'Profile';

    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handleUpdateProfile(form);
    };

    // Username
    const usernameGroup = document.createElement('div');
    usernameGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-300 mb-2">Username</label>
      <input 
        type="text" 
        name="username" 
        value="${this.profile.username}"
        required
        class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-white"
      />
    `;

    // User ID (read-only)
    const userIdGroup = document.createElement('div');
    userIdGroup.innerHTML = `
      <label class="block text-sm font-medium text-gray-300 mb-2">User ID</label>
      <input 
        type="text" 
        value="${this.profile.id}"
        readonly
        class="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm cursor-not-allowed"
      />
      <p class="text-xs text-gray-500 mt-1">This is your unique identifier</p>
    `;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition';
    saveBtn.textContent = 'Save Changes';

    form.appendChild(usernameGroup);
    form.appendChild(userIdGroup);
    form.appendChild(saveBtn);

    section.appendChild(sectionTitle);
    section.appendChild(form);

    return section;
  }

  renderAboutSection() {
    const section = document.createElement('div');
    section.className = 'space-y-4 pt-6 border-t border-gray-700';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'text-lg font-semibold text-gray-200 mb-4';
    sectionTitle.textContent = 'About';

    const info = document.createElement('div');
    info.className = 'space-y-3 text-sm text-gray-400';
    info.innerHTML = `
      <div>
        <p class="font-semibold text-purple-400 mb-1">Ninja Chat</p>
        <p>Encrypted P2P chat with WebRTC</p>
      </div>
      <div>
        <p class="font-semibold text-gray-300 mb-1">Features:</p>
        <ul class="list-disc list-inside space-y-1 ml-2">
          <li>End-to-end encrypted messaging</li>
          <li>Peer-to-peer video calls</li>
          <li>Direct messaging</li>
          <li>No server storage</li>
        </ul>
      </div>
      <div class="pt-2">
        <p class="text-xs text-gray-500">
          All communications are encrypted and transmitted directly between peers.
          Messages are not stored on any server.
        </p>
      </div>
    `;

    section.appendChild(sectionTitle);
    section.appendChild(info);

    return section;
  }

  handleUpdateProfile(form) {
    const formData = new FormData(form);
    const username = formData.get('username');

    if (username.trim()) {
      this.onUpdateProfile({ username: username.trim() });
    }
  }
}
