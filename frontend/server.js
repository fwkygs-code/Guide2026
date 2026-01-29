const express = require('express');
const path = require('path');

const app = express();
const buildDir = path.join(__dirname, 'build');
const backendBase = (process.env.PORTAL_OG_BACKEND || 'https://api.interguide.app').replace(/\/$/, '');

const proxyPortal = async (req, res) => {
  try {
    const targetUrl = `${backendBase}${req.originalUrl}`;
    const response = await fetch(targetUrl, {
      headers: {
        'user-agent': req.headers['user-agent'] || '',
        accept: req.headers.accept || 'text/html'
      }
    });
    const html = await response.text();
    res.status(response.status);
    res.setHeader('content-type', response.headers.get('content-type') || 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.sendFile(path.join(buildDir, 'index.html'));
  }
};

app.get(['/portal/*', '/portal'], proxyPortal);

app.use(express.static(buildDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Frontend server listening on ${port}`);
});
