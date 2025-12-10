const socket = io();

['log','warn','error'].forEach(m => {
  const old = console[m];
  console[m] = (...a) => {
    old(...a);
    socket.emit('browser-log', { method: m, args: a.map(x => ''+x) });
  };
});

export { socket };
