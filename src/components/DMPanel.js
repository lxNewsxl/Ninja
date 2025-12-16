// src/components/DMPanel.js
import { formatTimestamp, generateColor } from '../utils/helpers.js';

export class DMPanel {
  constructor(peerId, profile, onSendMessage, onClose) {
    this.peerId = peerId;
    this.profile = profile;
    this.onSendMessage = onSendMessage;
    this.onClose = onClose;
    this.messages = [];
    this.container = null;
    this.messagesContainer = null;
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'w-80 bg-gray-800 border-l border-gray-700 flex flex-col';

    // Header
    const header = document.createElement('div');
    header.className = 'px-4 py-3 border-b border-gray-700 flex justify-between items-center';

    const title = document.createElement('h3');
    title.className = 'font-semibold text-purple-400';
    title.textContent = `DM: User${this.peerId.substring(0, 4)}`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-gray-400 hover:text-white transition';
    closeBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
    closeBtn.onclick = () => this.onClose();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Messages
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'flex-1 overflow-y-auto p-4 space-y-3';

    // Input
    const inputArea = this.renderInputArea();

    this.container.appendChild(header);
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(inputArea);

    return this.container;
  }

  renderInputArea() {
    const inputArea = document.createElement('div');
    inputArea.className = 'border-t border-gray-700 p-3';

    const form = document.createElement('form');
    form.className = 'flex gap-2';
    form.onsubmit = (e) => {
      e.preventDefault();
      this.handleSendMessage(form);
    };

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'message';
    input.placeholder = 'Send DM...';
    input.className = 'flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-purple-500 text-white';
    input.required = true;

    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition';
    sendBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
      </svg>
    `;

    form.appendChild(input);
    form.appendChild(sendBtn);
    inputArea.appendChild(form);

    return inputArea;
  }

  renderMessage(message) {
    const messageEl = document.createElement('div');
    const isOwnMessage = message.userId === this.profile.id;
    
    messageEl.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-[200px] px-3 py-2 rounded-lg ${
      isOwnMessage 
        ? 'bg-purple-600 text-white' 
        : 'bg-gray-700 text-gray-100'
    }`;

    const text = document.createElement('div');
    text.className = 'text-sm break-words';
    text.textContent = message.text;

    const timestamp = document.createElement('div');
    timestamp.className = `text-xs mt-1 ${
      isOwnMessage ? 'text-purple-200' : 'text-gray-400'
    }`;
    timestamp.textContent = formatTimestamp(message.timestamp);

    bubble.appendChild(text);
    bubble.appendChild(timestamp);
    messageEl.appendChild(bubble);

    return messageEl;
  }

  handleSendMessage(form) {
    const formData = new FormData(form);
    const message = formData.get('message');

    if (message.trim()) {
      this.onSendMessage(message.trim());
      form.reset();
    }
  }

  addMessage(message) {
    this.messages.push(message);
    const messageEl = this.renderMessage(message);
    this.messagesContainer.appendChild(messageEl);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}
