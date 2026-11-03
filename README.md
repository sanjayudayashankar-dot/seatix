# Seatix cinema website

Seatix is a Java-served website with a browser-native WebGL auditorium. It uses no JavaScript framework or third-party 3D library. The supplied movie posters and auditorium seating diagrams are bundled in `src/main/resources/web/assets`.

## Database setup

1. For a new database, create the Seatix tables by running `database/schema.sql` in MySQL. For an existing database, run `database/booking-contact-migration.sql` once before accepting bookings. If that database predates the payment-status update, also run `database/payment-migration.sql` once.
2. Set the JDBC connection settings in the same terminal used to start the site. The URL is optional if MySQL is on the default local port.

```powershell
$env:SEATIX_DB_URL = "jdbc:mysql://localhost:3306/seatix?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true"
$env:SEATIX_DB_USER = "your_mysql_user"
$env:SEATIX_DB_PASSWORD = "your_mysql_password"
```

The site creates its demo guest, supported movie, auditorium and show records when the first booking is made. Do not use the generated demo guest for production customer accounts.

## Run locally

Requirements: JDK 17+, Maven 3.9+, and MySQL 8+.

```powershell
mvn compile exec:java
```

Open [http://localhost:8080](http://localhost:8080). Set `SEATIX_PORT` to change the default port. The website reports MySQL as unconfigured until the credentials are provided.

## Deploy as a shareable demo

The project includes a `Dockerfile` for container-based Java hosting. The container listens on `0.0.0.0` and uses the platform-provided `PORT` (default `8080`). Configure these environment variables in the hosting provider:

- `SEATIX_DB_URL`: JDBC URL for a reachable MySQL 8 database.
- `SEATIX_DB_USER` and `SEATIX_DB_PASSWORD`: credentials for that database.
- `SEATIX_HOST`: set to `0.0.0.0` if overriding the container default.
- `PORT`: set automatically by many hosting providers.

Run `database/schema.sql` on the hosted database before deploying. Keep database credentials in the provider's secret settings, never in source control or the Docker image. Configure the provider's health check to `GET /api/health`.

This project is currently a **demo**, not a production ticketing service: payment is simulated, seat availability is not loaded from a live theatre inventory, and customer contact details are stored without account verification or a self-service deletion flow. Visitors are warned to use test contact details only. Do not collect real customer data or sell real tickets until those production requirements are implemented.

### Free static demo: Vercel

The root `vercel.json` publishes only `src/main/resources/web`, which contains the interactive auditorium, supplied posters, and reference layouts. No JavaScript build tooling or package manager is required. This is a **view-only** deployment: Vercel does not run the Java/MySQL backend, and the website disables booking and contact-data collection when the backend health endpoint is unavailable.

1. Import the private GitHub repository `sanjayudayashankar-dot/seatix` in the Vercel dashboard.
2. Keep the project root at the repository root. Vercel reads `vercel.json`; no build command or environment variables are needed.
3. Deploy, then use the HTTPS URL Vercel gives the project.
4. Open the public site, confirm it says **View-only demo · booking disabled**, and share the URL.

This static demo is separate from the Java server. To enable bookings later, deploy the Java backend and configure a protected MySQL-compatible database; do not expose customer contact details in a public demo.

## Website controls

- Choose a movie from the poster shelf and pick a showtime.
- Choose IMAX, Orchestra / Mezzanine / Balcony, or Standard from the auditorium selector.
- Drag to orbit, right-drag to pan, scroll to zoom, and click individual 3D seats to select them.
- Use “Seat map references” to inspect the supplied layout images.
- Continue to create a pending booking in MySQL. The checkout dialog can simulate either a successful or failed payment; it never asks for card information and does not move money.
- Before a booking is created, enter an Indian mobile number and email address. Mobile numbers are normalized to `+91` format and saved with that booking in `booking_contacts`.

## Booking and payment status

Bookings and simulated payment status are written through JDBC. A successful simulation changes the payment to `SUCCESS` and booking to `CONFIRMED`. A failed simulation changes the payment to `FAILED`, cancels the booking and releases its seats. Pending checkouts expire after 15 minutes. The unique `(show_id, seat_id)` database key prevents two concurrent bookings of the same seat. Payment status is always simulated; do not connect it to real card or bank details.
