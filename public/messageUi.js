export function renderMessage(data, mine = false) {
  const m = document.createElement('div');
  m.className = mine ? "self-end" : "self-start";
  m.innerHTML = `
    <div class="max-w-2xl p-5 rounded-2xl ${mine ? 'bg-red-900/40' : 'bg-gray-900'} border border-gray-800">
      <div class="font-bold">${data.author}</div>
      ${data.text ? `<p>${data.text}</p>` : ''}
      ${data.attachments?.map(a => a.type.startsWith('image/') ? `<img src="data:${a.type};base64,${a.data}" class="rounded-xl my-2">` : '').join('')}
    </div>`;
  document.getElementById('messages').appendChild(m);
  m.scrollIntoView({behavior:'smooth'});
}
