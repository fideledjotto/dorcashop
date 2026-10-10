CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    cats JSON NOT NULL,
    img MEDIUMTEXT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_visits (
    visitor_id CHAR(36) NOT NULL,
    visit_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (visitor_id, visit_date),
    INDEX idx_site_visits_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(40) NOT NULL,
    visitor_id CHAR(36) NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    item_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_site_events_type_created (event_type, created_at),
    INDEX idx_site_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_sessions (
    session_id VARCHAR(128) NOT NULL PRIMARY KEY,
    session_data MEDIUMBLOB NOT NULL,
    last_activity INT UNSIGNED NOT NULL,
    INDEX idx_api_sessions_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 
