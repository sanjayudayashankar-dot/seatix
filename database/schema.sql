CREATE DATABASE IF NOT EXISTS seatix;
USE seatix;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoriums (
    auditorium_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    cinema_name VARCHAR(150) NOT NULL,
    auditorium_name VARCHAR(100) NOT NULL,
    auditorium_type ENUM('IMAX','ORCHESTRA','STANDARD') NOT NULL,
    UNIQUE KEY uq_cinema_auditorium (cinema_name, auditorium_name)
);

CREATE TABLE IF NOT EXISTS seats (
    seat_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    auditorium_id BIGINT NOT NULL,
    section_name VARCHAR(50) NOT NULL,
    row_label VARCHAR(10) NOT NULL,
    seat_number INT NOT NULL,
    category ENUM('STANDARD','PREMIUM','ACCESSIBLE') NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    UNIQUE KEY uq_physical_seat (auditorium_id, section_name, row_label, seat_number),
    FOREIGN KEY (auditorium_id) REFERENCES auditoriums(auditorium_id)
);

CREATE TABLE IF NOT EXISTS movies (
    movie_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    duration_minutes INT,
    UNIQUE KEY uq_movie_title (title)
);

CREATE TABLE IF NOT EXISTS shows (
    show_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    movie_id BIGINT NOT NULL,
    auditorium_id BIGINT NOT NULL,
    starts_at DATETIME NOT NULL,
    UNIQUE KEY uq_movie_auditorium_start (movie_id, auditorium_id, starts_at),
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id),
    FOREIGN KEY (auditorium_id) REFERENCES auditoriums(auditorium_id)
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('PENDING','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (show_id) REFERENCES shows(show_id)
);

CREATE TABLE IF NOT EXISTS booking_contacts (
    booking_id BIGINT PRIMARY KEY,
    phone_e164 VARCHAR(13) NOT NULL,
    email VARCHAR(254) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS booking_seats (
    booking_seat_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    booking_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    seat_id BIGINT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    UNIQUE KEY uq_show_seat (show_id, seat_id),
    UNIQUE KEY uq_booking_seat (booking_id, seat_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (show_id) REFERENCES shows(show_id),
    FOREIGN KEY (seat_id) REFERENCES seats(seat_id)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    booking_id BIGINT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(40) DEFAULT 'DEMO',
    payment_status ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
    UNIQUE KEY uq_booking_payment (booking_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);
