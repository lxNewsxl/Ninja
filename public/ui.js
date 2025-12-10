export function showModal(title, content, buttons = []) {
  const modal = document.createElement('div');
  modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-50";
  modal.innerHTML = `
  <div class="w-full max-w-md p-8 bg-gray-950 rounded-3xl border border-gray-800 space-y-6">
    <h2 class="text-3xl font-bold text-center">${title}</h2>
    ${content}
    ${buttons.map(b => `<button onclick="${b.onClick}" class="w-full py-5 text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl">${b.label}</button>`).join('')}
  </div>`;
  document.body.appendChild(modal);
  return modal;
}
