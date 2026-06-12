CREATE DATABASE IF NOT EXISTS employment_system
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE employment_system;

DROP TABLE IF EXISTS employment_info;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL,
    name        VARCHAR(50)  NOT NULL,
    password    VARCHAR(255) NOT NULL DEFAULT '123456',
    department  VARCHAR(100) DEFAULT '',
    class_name  VARCHAR(100) DEFAULT '',
    role        VARCHAR(20)  NOT NULL DEFAULT 'student',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE employment_info (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    username          VARCHAR(50)  NOT NULL,
    name              VARCHAR(50)  DEFAULT '',
    department        VARCHAR(100) DEFAULT '',
    class_name        VARCHAR(100) DEFAULT '',
    employment_status VARCHAR(100) DEFAULT NULL,
    unit              VARCHAR(255) DEFAULT '',
    phone             VARCHAR(50)  DEFAULT '',
    detail            JSON DEFAULT NULL,
    notes             TEXT DEFAULT NULL,
    other_info        TEXT DEFAULT NULL,
    raw_excel_row     JSON DEFAULT NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username),
    INDEX  idx_status (employment_status),
    INDEX  idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (username, name, password, department, class_name, role)
VALUES ('admin', 'admin', '123456', 'admin', 'admin', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';

SELECT 'OK' AS status;
SELECT * FROM users WHERE role = 'admin';