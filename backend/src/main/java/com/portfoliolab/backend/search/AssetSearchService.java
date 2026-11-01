package com.portfoliolab.backend.search;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AssetSearchService {

    private final OllamaEmbeddingClient embeddingClient;
    private final AssetSearchRepository repository;

    public AssetSearchService(OllamaEmbeddingClient embeddingClient,
                              AssetSearchRepository repository) {
        this.embeddingClient = embeddingClient;
        this.repository = repository;
    }

    public List<AssetSearchResult> semanticSearch(String query, int limit) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Query must not be blank");
        }
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        double[] vector = embeddingClient.embed(query);
        String embedding = OllamaEmbeddingClient.formatVector(vector);
        return repository.searchNearest(embedding, safeLimit);
    }
}