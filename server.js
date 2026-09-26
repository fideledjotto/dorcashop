const express = require('express');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const productsFile = path.join(dataDir, 'products.json');
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin0';

function loadDefaultProducts() {
  const dataPath = path.join(rootDir, 'js', 'data.js');
  const source = fs.readFileSync(dataPath, 'utf8');
  const sandbox = { console, PRODUCTS: [] };
  vm.runInNewContext(source, sandbox);
  return Array.isArray(sandbox.PRODUCTS) ? sandbox.PRODUCTS : [];
}

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(productsFile)) {
    const defaults = loadDefaultProducts();
    fs.writeFileSync(productsFile, JSON.stringify(defaults, null, 2));
  }
}

function readProducts() {
  ensureDataFile();
  const raw = fs.readFileSync(productsFile, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeProducts(products) {
  ensureDataFile();
  fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
}

function normalizeProduct(product) {
  const normalized = product && typeof product === 'object' ? product : {};
  return {
    id: String(normalized.id || normalized.name || `product-${Date.now()}`),
    name: String(normalized.name || 'Produit'),
    cats: Array.isArray(normalized.cats) && normalized.cats.length ? normalized.cats : [normalized.category || 'fournitures'],
    category: String(normalized.category || normalized.cats?.[0] || 'fournitures'),
    img: normalized.img || '',
    desc: normalized.desc || '',
    price: normalized.price || '0 F',
    oldPrice: normalized.oldPrice || '',
    priceNote: normalized.priceNote || '',
    priceGros: normalized.priceGros || '',
    badge: normalized.badge || '',
    details: normalized.details || null,
    icon: normalized.icon || '',
    createdAt: Number(normalized.createdAt || Date.now())
  };
}

function sortProducts(products) {
  return [...products].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

app.use(express.json({ limit: '10mb' }));

app.get('/api/products', (req, res) => {
  const products = sortProducts(readProducts().map(normalizeProduct));
  res.json({ products });
});

app.post('/api/products', (req, res) => {
  const payload = req.body || {};
  const name = String(payload.name || '').trim();

  if (!name) {
    return res.status(400).json({ success: false, message: 'Le nom du produit est requis.' });
  }

  const current = readProducts();
  const product = normalizeProduct({
    ...payload,
    id: payload.id || `custom-${Date.now()}`,
    category: payload.category || (Array.isArray(payload.cats) ? payload.cats[0] : 'fournitures'),
    cats: Array.isArray(payload.cats) && payload.cats.length ? payload.cats : [payload.category || 'fournitures'],
    createdAt: Date.now()
  });

  current.unshift(product);
  writeProducts(sortProducts(current.map(normalizeProduct)));
  return res.status(201).json({ success: true, product });
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const products = readProducts().map(normalizeProduct);
  const index = products.findIndex((product) => String(product.id) === String(id));

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Produit introuvable.' });
  }

  const updated = normalizeProduct({
    ...products[index],
    ...payload,
    id,
    createdAt: Number(products[index].createdAt || Date.now())
  });

  products[index] = updated;
  writeProducts(sortProducts(products.map(normalizeProduct)));
  res.json({ success: true, product: updated });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const products = readProducts().filter((product) => String(product.id) !== String(id));
  writeProducts(products);
  res.json({ success: true, removedId: id });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (username === adminUsername && password === adminPassword) {
    return res.json({ success: true, message: 'Connexion réussie.' });
  }

  return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
});

app.use(express.static(rootDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  const candidates = [
    path.join(rootDir, req.path),
    path.join(rootDir, req.path.replace(/^\//, ''))
  ];

  const fileExists = candidates.some((candidate) => {
    try {
      return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
    } catch (error) {
      return false;
    }
  });

  if (fileExists) {
    return res.sendFile(candidates.find((candidate) => fs.existsSync(candidate)));
  }

  return res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Serveur DORCASHOP démarré sur http://localhost:${port}`);
});
