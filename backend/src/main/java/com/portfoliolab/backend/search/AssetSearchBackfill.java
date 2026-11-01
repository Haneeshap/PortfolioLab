package com.portfoliolab.backend.search;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AssetSearchBackfill implements CommandLineRunner {

    private final OllamaEmbeddingClient embeddingClient;
    private final JdbcTemplate jdbcTemplate;

    public AssetSearchBackfill(OllamaEmbeddingClient embeddingClient,
                               JdbcTemplate jdbcTemplate) {
        this.embeddingClient = embeddingClient;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        try {
            List<Long> assetIds = jdbcTemplate.queryForList(
                    "SELECT id FROM assets ORDER BY id", Long.class);
            for (Long assetId : assetIds) {
                Boolean exists = jdbcTemplate.queryForObject(
                        "SELECT EXISTS(SELECT 1 FROM asset_search_embeddings WHERE asset_id = ?)",
                        Boolean.class, assetId);
                if (Boolean.TRUE.equals(exists)) {
                    continue;
                }
                Object[] row = jdbcTemplate.queryForObject(
                        "SELECT symbol, name, sector, description FROM assets WHERE id = ?",
                        (rs, rn) -> new Object[]{
                                rs.getString("symbol"),
                                rs.getString("name"),
                                rs.getString("sector"),
                                rs.getString("description")
                        },
                        assetId);
                if (row == null) {
                    continue;
                }
                String content = java.util.stream.Stream.of(
                        String.valueOf(row[0]),
                        String.valueOf(row[1]),
                        row[2] == null ? "" : String.valueOf(row[2]),
                        row[3] == null ? "" : String.valueOf(row[3]))
                        .filter(s -> !s.isBlank())
                        .reduce((a, b) -> a + " " + b)
                        .orElse("");
                if (content.isBlank()) {
                    continue;
                }
                double[] vector = embeddingClient.embed(content);
                String embedding = OllamaEmbeddingClient.formatVector(vector);
                jdbcTemplate.update(
                        "INSERT INTO asset_search_embeddings (asset_id, content, embedding) "
                                + "VALUES (?, ?, CAST(? AS vector(768)))",
                        assetId, content, embedding);
            }
        } catch (Exception e) {
            // Best-effort only: search degrades gracefully to empty until embeddings are backfilled.
            System.err.println("[asset-search] Embedding backfill skipped: " + e.getMessage());
        }
    }
}