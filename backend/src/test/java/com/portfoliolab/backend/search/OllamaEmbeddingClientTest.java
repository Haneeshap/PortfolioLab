package com.portfoliolab.backend.search;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OllamaEmbeddingClientTest {

    @Test
    void formatVectorWrapsValuesInBrackets() {
        double[] vector = {0.5, -0.25, 0.125};
        assertEquals("[0.5,-0.25,0.125]", OllamaEmbeddingClient.formatVector(vector));
    }

    @Test
    void parseEmbeddingExtractsArray() {
        double[] vector = OllamaEmbeddingClient.parseEmbedding(
                "{\"model\":\"nomic-embed-text\",\"embedding\":[0.1,-0.2,0.3]}");
        assertArrayEquals(new double[]{0.1, -0.2, 0.3}, vector, 1e-9);
    }

    @Test
    void parseEmbeddingRejectsMissingArray() {
        assertThrows(IllegalStateException.class,
                () -> OllamaEmbeddingClient.parseEmbedding("{\"model\":\"x\"}"));
    }
}