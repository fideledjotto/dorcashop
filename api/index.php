<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';

header('Content-Type: application/json; charset=utf-8');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function readPayload(): array
{
    $payload = json_decode((string)file_get_contents('php://input'), true);
    return is_array($payload) ? $payload : [];
}

function requireAdminAccount(): void
{
    if (($_SESSION['account']['role'] ?? '') !== 'admin') {
        respond(['success' => false, 'message' => 'Accès réservé à l’administration.'], 403);
    }
}

function recordSiteEvent(PDO $pdo, string $type, string $description, ?string $visitorId = null, float $amount = 0, int $itemCount = 0): void
{
    $statement = $pdo->prepare(
        'INSERT INTO site_events (event_type, visitor_id, description, amount, item_count) VALUES (?, ?, ?, ?, ?)'
    );
    $statement->execute([$type, $visitorId, $description, $amount, $itemCount]);
}

function validVisitorId(mixed $value): bool
{
    return is_string($value) && preg_match('/^[a-f0-9-]{36}$/i', $value) === 1;
}

try {
    $pdo = database();
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $scriptDirectory = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    $applicationPath = rtrim(dirname($scriptDirectory), '/');
    if ($applicationPath !== '' && $applicationPath !== '/' && str_starts_with($path, $applicationPath . '/')) {
        $path = substr($path, strlen($applicationPath));
    }
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($path === '/api/analytics/visit' && $method === 'POST') {
        $payload = readPayload();
        $visitorId = $payload['visitorId'] ?? null;
        if (!validVisitorId($visitorId)) {
            respond(['success' => false, 'message' => 'Identifiant visiteur invalide.'], 400);
        }
        $statement = $pdo->prepare('INSERT IGNORE INTO site_visits (visitor_id, visit_date) VALUES (?, CURDATE())');
        $statement->execute([$visitorId]);
        respond(['success' => true]);
    }

    if ($path === '/api/analytics/order-intent' && $method === 'POST') {
        $payload = readPayload();
        $visitorId = $payload['visitorId'] ?? null;
        $itemCount = filter_var($payload['itemCount'] ?? null, FILTER_VALIDATE_INT);
        $amount = $payload['amount'] ?? null;
        if (!validVisitorId($visitorId) || $itemCount === false || $itemCount < 1 || $itemCount > 1000 || !is_numeric($amount) || (float)$amount < 0 || (float)$amount > 999999999) {
            respond(['success' => false, 'message' => 'Données de commande invalides.'], 400);
        }
        recordSiteEvent($pdo, 'whatsapp_order', 'Panier transmis sur WhatsApp', $visitorId, (float)$amount, $itemCount);
        respond(['success' => true], 201);
    }

    if ($path === '/api/analytics' && $method === 'GET') {
        requireAdminAccount();
        $startDate = (new DateTimeImmutable('today'))->modify('-6 days')->format('Y-m-d');
        $daily = [];
        for ($offset = 6; $offset >= 0; $offset--) {
            $date = (new DateTimeImmutable('today'))->modify('-' . $offset . ' days');
            $daily[$date->format('Y-m-d')] = [
                'date' => $date->format('Y-m-d'),
                'label' => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][(int)$date->format('N') - 1],
                'visitors' => 0,
                'orders' => 0,
                'potentialRevenue' => 0,
            ];
        }

        $statement = $pdo->prepare(
            'SELECT visit_date, COUNT(DISTINCT visitor_id) AS visitors FROM site_visits WHERE visit_date >= ? AND visit_date <= CURDATE() GROUP BY visit_date'
        );
        $statement->execute([$startDate]);
        foreach ($statement->fetchAll() as $row) {
            $day = (string)$row['visit_date'];
            if (isset($daily[$day])) {
                $daily[$day]['visitors'] = (int)$row['visitors'];
            }
        }

        $statement = $pdo->prepare(
            "SELECT DATE(created_at) AS event_date, COUNT(*) AS orders, SUM(amount) AS potential_revenue FROM site_events WHERE event_type = 'whatsapp_order' AND created_at >= ? GROUP BY DATE(created_at)"
        );
        $statement->execute([$startDate . ' 00:00:00']);
        foreach ($statement->fetchAll() as $row) {
            $day = (string)$row['event_date'];
            if (isset($daily[$day])) {
                $daily[$day]['orders'] = (int)$row['orders'];
                $daily[$day]['potentialRevenue'] = (float)$row['potential_revenue'];
            }
        }

        $statement = $pdo->prepare(
            "SELECT COUNT(*) AS order_count, COALESCE(SUM(amount), 0) AS potential_revenue FROM site_events WHERE event_type = 'whatsapp_order' AND created_at >= ?"
        );
        $statement->execute([$startDate . ' 00:00:00']);
        $orders = $statement->fetch();
        $visitors = (int)$pdo->query(
            "SELECT COUNT(DISTINCT visitor_id) FROM site_visits WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)"
        )->fetchColumn();
        $clientCount = (int)$pdo->query('SELECT COUNT(*) FROM customer_accounts')->fetchColumn();
        $statement = $pdo->prepare('SELECT COUNT(*) FROM customer_accounts WHERE created_at >= ?');
        $statement->execute([$startDate . ' 00:00:00']);
        $newClients = (int)$statement->fetchColumn();
        $productCount = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
        $productsWithImage = (int)$pdo->query("SELECT COUNT(*) FROM products WHERE img IS NOT NULL AND TRIM(img) <> ''")->fetchColumn();
        $categories = $pdo->query('SELECT category AS label, COUNT(*) AS count FROM products GROUP BY category ORDER BY count DESC, label ASC')->fetchAll();
        $activity = $pdo->query(
            'SELECT event_type AS type, description, amount, item_count AS itemCount, created_at AS createdAt FROM site_events ORDER BY id DESC LIMIT 12'
        )->fetchAll();
        $orderCount = (int)$orders['order_count'];

        respond([
            'period' => ['start' => $startDate, 'end' => date('Y-m-d')],
            'summary' => [
                'visitors' => $visitors,
                'clients' => $clientCount,
                'newClients' => $newClients,
                'whatsappOrders' => $orderCount,
                'potentialRevenue' => (float)$orders['potential_revenue'],
                'orderIntentRate' => $visitors > 0 ? round(($orderCount / $visitors) * 100, 1) : 0,
                'products' => $productCount,
                'productsWithImage' => $productsWithImage,
                'catalogImageRate' => $productCount > 0 ? round(($productsWithImage / $productCount) * 100, 1) : 0,
                'confirmedSalesTracked' => false,
            ],
            'daily' => array_values($daily),
            'categories' => $categories,
            'activity' => $activity,
        ]);
    }

    if ($path === '/api/products' && $method === 'GET') {
        $rows = $pdo->query('SELECT * FROM products ORDER BY created_at DESC, id DESC')->fetchAll();
        respond(['products' => array_map('productFromRow', $rows)]);
    }

    if ($path === '/api/products' && $method === 'POST') {
        requireAdminAccount();
        $payload = readPayload();
        if (trim((string)($payload['name'] ?? '')) === '') {
            respond(['success' => false, 'message' => 'Le nom du produit est requis.'], 400);
        }

        $payload['id'] = $payload['id'] ?? ('custom-' . (int)(microtime(true) * 1000));
        $payload['category'] = $payload['category'] ?? ($payload['cats'][0] ?? 'fournitures');
        $payload['cats'] = $payload['cats'] ?? [$payload['category']];
        $payload['createdAt'] = (int)(microtime(true) * 1000);
        $product = normalizeProduct($payload);
        insertProduct($pdo, $product);
        recordSiteEvent($pdo, 'product_added', 'Produit ajouté : ' . $product['name']);
        respond(['success' => true, 'product' => $product], 201);
    }

    if (preg_match('~^/api/products/([^/]+)$~', $path, $matches)) {
        $id = rawurldecode($matches[1]);
        if ($method === 'PUT' || $method === 'DELETE') {
            requireAdminAccount();
        }

        if ($method === 'PUT') {
            $statement = $pdo->prepare('SELECT * FROM products WHERE id = ?');
            $statement->execute([$id]);
            $row = $statement->fetch();
            if (!$row) {
                respond(['success' => false, 'message' => 'Produit introuvable.'], 404);
            }

            $current = productFromRow($row);
            $payload = readPayload();
            $updated = normalizeProduct(array_merge($current, $payload, [
                'id' => $id,
                'createdAt' => $current['createdAt'],
            ]));
            $statement = $pdo->prepare(
                'UPDATE products SET
                    name = ?, category = ?, cats = ?, img = ?, description = ?, price = ?,
                    old_price = ?, price_note = ?, price_gros = ?, badge = ?, details = ?,
                    icon = ?, created_at = ?
                WHERE id = ?'
            );
            $statement->execute([
                $updated['name'],
                $updated['category'],
                json_encode($updated['cats'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                $updated['img'],
                $updated['desc'],
                $updated['price'],
                $updated['oldPrice'],
                $updated['priceNote'],
                $updated['priceGros'],
                $updated['badge'],
                $updated['details'] === null ? null : json_encode($updated['details'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                $updated['icon'],
                $updated['createdAt'],
                $id,
            ]);
            recordSiteEvent($pdo, 'product_updated', 'Produit modifié : ' . $updated['name']);
            respond(['success' => true, 'product' => $updated]);
        }

        if ($method === 'DELETE') {
            $statement = $pdo->prepare('SELECT name FROM products WHERE id = ?');
            $statement->execute([$id]);
            $productName = $statement->fetchColumn();
            $statement = $pdo->prepare('DELETE FROM products WHERE id = ?');
            $statement->execute([$id]);
            if ($productName !== false) {
                recordSiteEvent($pdo, 'product_deleted', 'Produit supprimé : ' . $productName);
            }
            respond(['success' => true, 'removedId' => $id]);
        }
    }

    if ($path === '/api/register' && $method === 'POST') {
        $payload = readPayload();
        $name = trim((string)($payload['name'] ?? ''));
        $email = strtolower(trim((string)($payload['email'] ?? '')));
        $password = (string)($payload['password'] ?? '');

        if (strlen($name) < 2 || strlen($name) > 120) {
            respond(['success' => false, 'message' => 'Le nom doit contenir entre 2 et 120 caractères.'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(['success' => false, 'message' => 'Veuillez saisir une adresse e-mail valide.'], 400);
        }
        if (strlen($password) < 8) {
            respond(['success' => false, 'message' => 'Le mot de passe doit contenir au moins 8 caractères.'], 400);
        }

        try {
            $statement = $pdo->prepare('INSERT INTO customer_accounts (name, email, password_hash) VALUES (?, ?, ?)');
            $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                respond(['success' => false, 'message' => 'Cette adresse e-mail possède déjà un compte.'], 409);
            }
            throw $error;
        }

        $account = [
            'id' => (int)$pdo->lastInsertId(),
            'role' => 'client',
            'name' => $name,
            'email' => $email,
        ];
        recordSiteEvent($pdo, 'client_registered', 'Nouveau compte client');
        session_regenerate_id(true);
        $_SESSION['account'] = $account;
        respond(['success' => true, 'role' => 'client', 'account' => $account], 201);
    }

    if ($path === '/api/login' && $method === 'POST') {
        $payload = readPayload();
        $username = trim((string)($payload['identifier'] ?? $payload['username'] ?? $payload['email'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        $adminUsername = getenv('ADMIN_USERNAME') ?: 'admin';
        $adminPassword = getenv('ADMIN_PASSWORD') ?: 'admin0';

        if (hash_equals($adminUsername, $username) && hash_equals($adminPassword, $password)) {
            $account = ['role' => 'admin'];
            session_regenerate_id(true);
            $_SESSION['account'] = $account;
            respond(['success' => true, 'role' => 'admin', 'account' => $account, 'message' => 'Connexion réussie.']);
        }

        if (filter_var($username, FILTER_VALIDATE_EMAIL)) {
            $statement = $pdo->prepare('SELECT id, name, email, password_hash FROM customer_accounts WHERE email = ?');
            $statement->execute([strtolower($username)]);
            $customer = $statement->fetch();
            if ($customer && password_verify($password, $customer['password_hash'])) {
                $account = [
                    'id' => (int)$customer['id'],
                    'role' => 'client',
                    'name' => $customer['name'],
                    'email' => $customer['email'],
                ];
                session_regenerate_id(true);
                $_SESSION['account'] = $account;
                respond(['success' => true, 'role' => 'client', 'account' => $account, 'message' => 'Connexion réussie.']);
            }
        }

        respond(['success' => false, 'message' => 'Identifiants incorrects.'], 401);
    }

    if ($path === '/api/session' && $method === 'GET') {
        $account = $_SESSION['account'] ?? null;
        respond(['authenticated' => is_array($account), 'account' => is_array($account) ? $account : null]);
    }

    if ($path === '/api/logout' && $method === 'POST') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => '/',
                'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
        respond(['success' => true]);
    }

    respond(['success' => false, 'message' => 'Route API inconnue.'], 404);
} catch (Throwable $error) {
    error_log($error->__toString());
    respond(['success' => false, 'message' => 'Erreur lors de l’accès à la base MySQL.'], 500);
}