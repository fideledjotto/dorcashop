<?php

declare(strict_types=1);

function database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('MYSQL_HOST') ?: '127.0.0.1';
    $port = getenv('MYSQL_PORT') ?: '3306';
    $name = getenv('MYSQL_DATABASE') ?: 'dorcashop';
    $user = getenv('MYSQL_USER') ?: 'root';
    $password = getenv('MYSQL_PASSWORD') ?: '';

    if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) {
        throw new RuntimeException('MYSQL_DATABASE ne peut contenir que des lettres, chiffres et underscores.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $createDatabaseSetting = getenv('MYSQL_CREATE_DATABASE');
    $createDatabase = $createDatabaseSetting === false
        ? true
        : filter_var($createDatabaseSetting, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($createDatabase === null) {
        throw new RuntimeException('MYSQL_CREATE_DATABASE doit valoir true ou false.');
    }
    if ($createDatabase) {
        $bootstrap = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $password, $options);
        $bootstrap->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        unset($bootstrap);
    }

    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $password, $options);
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(191) NOT NULL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL,
            cats JSON NOT NULL,
            img TEXT NULL,
            description TEXT NULL,
            price VARCHAR(255) NOT NULL,
            old_price VARCHAR(255) NULL,
            price_note VARCHAR(255) NULL,
            price_gros VARCHAR(255) NULL,
            badge VARCHAR(100) NULL,
            details JSON NULL,
            icon TEXT NULL,
            created_at BIGINT NOT NULL,
            INDEX idx_products_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS customer_accounts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(191) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS site_visits (
            visitor_id CHAR(36) NOT NULL,
            visit_date DATE NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (visitor_id, visit_date),
            INDEX idx_site_visits_date (visit_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS site_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            event_type VARCHAR(40) NOT NULL,
            visitor_id CHAR(36) NULL,
            description VARCHAR(255) NOT NULL,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            item_count INT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_site_events_type_created (event_type, created_at),
            INDEX idx_site_events_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    seedProductsFromJson($pdo);
    return $pdo;
}

function normalizeProduct(array $product): array
{
    $cats = $product['cats'] ?? null;
    if (!is_array($cats) || count($cats) === 0) {
        $cats = [$product['category'] ?? 'fournitures'];
    }

    return [
        'id' => (string)($product['id'] ?? $product['name'] ?? ('product-' . (int)(microtime(true) * 1000))),
        'name' => (string)($product['name'] ?? 'Produit'),
        'category' => (string)($product['category'] ?? $cats[0] ?? 'fournitures'),
        'cats' => array_values($cats),
        'img' => (string)($product['img'] ?? ''),
        'desc' => (string)($product['desc'] ?? ''),
        'price' => (string)($product['price'] ?? '0 F'),
        'oldPrice' => (string)($product['oldPrice'] ?? ''),
        'priceNote' => (string)($product['priceNote'] ?? ''),
        'priceGros' => (string)($product['priceGros'] ?? ''),
        'badge' => (string)($product['badge'] ?? ''),
        'details' => $product['details'] ?? null,
        'icon' => (string)($product['icon'] ?? ''),
        'createdAt' => (int)($product['createdAt'] ?? (microtime(true) * 1000)),
    ];
}

function insertProduct(PDO $pdo, array $product): void
{
    $product = normalizeProduct($product);
    $statement = $pdo->prepare(
        'INSERT INTO products (
            id, name, category, cats, img, description, price, old_price,
            price_note, price_gros, badge, details, icon, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $product['id'],
        $product['name'],
        $product['category'],
        json_encode($product['cats'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        $product['img'],
        $product['desc'],
        $product['price'],
        $product['oldPrice'],
        $product['priceNote'],
        $product['priceGros'],
        $product['badge'],
        $product['details'] === null ? null : json_encode($product['details'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        $product['icon'],
        $product['createdAt'],
    ]);
}

function productFromRow(array $row): array
{
    $row['cats'] = json_decode((string)$row['cats'], true) ?: [];
    $row['details'] = $row['details'] === null ? null : json_decode((string)$row['details'], true);

    return normalizeProduct([
        'id' => $row['id'],
        'name' => $row['name'],
        'category' => $row['category'],
        'cats' => $row['cats'],
        'img' => $row['img'],
        'desc' => $row['description'],
        'price' => $row['price'],
        'oldPrice' => $row['old_price'],
        'priceNote' => $row['price_note'],
        'priceGros' => $row['price_gros'],
        'badge' => $row['badge'],
        'details' => $row['details'],
        'icon' => $row['icon'],
        'createdAt' => $row['created_at'],
    ]);
}

function seedProductsFromJson(PDO $pdo): void
{
    if ((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() > 0) {
        return;
    }

    $productsFile = dirname(__DIR__) . '/data/products.json';
    if (!is_file($productsFile)) {
        return;
    }

    $products = json_decode((string)file_get_contents($productsFile), true);
    if (!is_array($products) || count($products) === 0) {
        return;
    }

    $pdo->beginTransaction();
    try {
        foreach ($products as $product) {
            if (is_array($product)) {
                insertProduct($pdo, $product);
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}