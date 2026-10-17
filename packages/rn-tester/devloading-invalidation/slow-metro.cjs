const http = require('node:http');
const net = require('node:net');
const server = http.createServer((req, res) => {
  const delay = req.url.includes('.bundle') ? 6000 : 0;
  console.log(new Date().toISOString(), 'request', req.url, 'delay', delay);
  setTimeout(() => {
    const upstream = http.request({hostname: '127.0.0.1', port: 8081, path: req.url, method: req.method, headers: req.headers}, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', error => { res.writeHead(502); res.end(String(error)); });
    req.pipe(upstream);
  }, delay);
});
server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(8081, '127.0.0.1', () => {
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k,v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.listen(8082, '127.0.0.1', () => console.log('Slow Metro proxy on 8082; bundle response delayed by 6 seconds.'));
