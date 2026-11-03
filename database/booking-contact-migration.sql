USE seatix;

-- Run once against an existing Seatix database before accepting new bookings.
CREATE TABLE IF NOT EXISTS booking_contacts (
    booking_id BIGINT PRIMARY KEY,
    phone_e164 VARCHAR(13) NOT NULL,
    email VARCHAR(254) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_contacts_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);
