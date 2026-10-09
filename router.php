<?php

declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/api' || str_starts_with($path, '/api/')) {
    require __DIR__ . '/api/index.php';
    return true;
}

$requestedFile = realpath(__DIR__ . $path);
$root = realpath(__DIR__);
if ($requestedFile !== false && $root !== false && str_starts_with($requestedFile, $root . DIRECTORY_SEPARATOR) && is_file($requestedFile)) {
    return false;
}

readfile(__DIR__ . '/index.html');
return true;