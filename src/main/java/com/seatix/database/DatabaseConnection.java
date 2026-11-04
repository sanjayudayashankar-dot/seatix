package com.seatix.database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class DatabaseConnection {
    private static final String DEFAULT_URL =
            "jdbc:postgresql://localhost:5432/seatix";

    private DatabaseConnection() {}

    public static boolean isConfigured() {
        return hasValue("SEATIX_DB_USER") && hasValue("SEATIX_DB_PASSWORD");
    }

    public static Connection open() throws SQLException {
        String user = System.getenv("SEATIX_DB_USER");
        String password = System.getenv("SEATIX_DB_PASSWORD");
        if (user == null || user.isBlank() || password == null) {
            throw new IllegalStateException(
                    "Database credentials are not configured. Set SEATIX_DB_USER and SEATIX_DB_PASSWORD.");
        }
        String url = System.getenv("SEATIX_DB_URL");
        return DriverManager.getConnection(url == null || url.isBlank() ? DEFAULT_URL : url, user, password);
    }

    private static boolean hasValue(String name) {
        String value = System.getenv(name);
        return value != null && !value.isBlank();
    }
}
