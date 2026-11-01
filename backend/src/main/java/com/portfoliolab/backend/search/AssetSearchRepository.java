package com.portfoliolab.backend.search;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class AssetSearchRepository {

    private static final int EMBEDDING_DIMENSION = 768;

    private static final String SEARCH_SQL = """
            SELECT a.id AS asset_id,
                   a.symbol,
                   a.name,
                   a.sector,
                   a.description,
                   1 - (e.embedding <=> CAST(? AS vector(768))) AS similarity
            FROM asset_search_embeddings e
            JOIN assets a ON a.id = e.asset_id
            ORDER BY e.embedding <=> CAST(? AS vector(768)) ASC
            LIMIT ?
            """;

    private final JdbcTemplate jdbcTemplate;

    public AssetSearchRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<AssetSearchResult> searchNearest(String embedding, int limit) {
        return jdbcTemplate.query(
                SEARCH_SQL,
                new Object[]{embedding, embedding, limit},
                (rs, rowNum) -> new AssetSearchResult(
                        rs.getLong("asset_id"),
                        rs.getString("symbol"),
                        rs.getString("name"),
                        rs.getString("sector"),
                        rs.getString("description"),
                        rs.getBigDecimal("similarity").doubleValue()
                ));
    }
}