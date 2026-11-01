 package com.portfoliolab.backend.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class OllamaEmbeddingClient {

    private static final String OLLAMA_EMBED_URL = "http://127.0.0.1:11434/api/embeddings";
    private static final String EMBEDDING_MODEL = "nomic-embed-text";
    static final int EMBEDDING_DIMENSION = 768;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public double[] embed(String text) {
        try {
            String json = MAPPER.writeValueAsString(
                    MAPPER.createObjectNode()
                            .put("model", EMBEDDING_MODEL)
                            .put("prompt", text));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(OLLAMA_EMBED_URL))
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Ollama embeddings returned HTTP " + response.statusCode());
            }
            double[] vector = parseEmbedding(response.body());
            if (vector.length != EMBEDDING_DIMENSION) {
                throw new IllegalStateException("Expected " + EMBEDDING_DIMENSION + " embedding dimensions, got " + vector.length);
            }
            return vector;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Unable to call Ollama embeddings at " + OLLAMA_EMBED_URL, e);
        }
    }

    static double[] parseEmbedding(String body) {
        try {
            JsonNode root = MAPPER.readTree(body);
            JsonNode embedding = root.get("embedding");
            if (embedding == null || !embedding.isArray()) {
                throw new IllegalStateException("Ollama embeddings response missing embedding array");
            }
            double[] vector = new double[embedding.size()];
            for (int i = 0; i < embedding.size(); i++) {
                vector[i] = embedding.get(i).asDouble();
            }
            return vector;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Unable to parse Ollama embeddings response", e);
        }
    }

    public static String formatVector(double[] vector) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(vector[i]);
        }
        sb.append(']');
        return sb.toString();
    }

    public int dimension() {
        return EMBEDDING_DIMENSION;
    }
}