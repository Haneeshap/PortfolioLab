
package com.portfoliolab.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
class DatabaseConnectionTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void canQueryPostgreSQL() {
        String databaseName = jdbcTemplate.queryForObject(
            "SELECT current_database()",
            String.class
        );

        assertEquals("portfoliolab", databaseName);
    }
}
