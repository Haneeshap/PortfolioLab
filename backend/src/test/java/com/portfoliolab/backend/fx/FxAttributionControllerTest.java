
package com.portfoliolab.backend.fx;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class FxAttributionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void validRequestReturnsCorrectAttribution() throws Exception {
        String json = """
            {
              "quantity": 1,
              "purchasePrice": 100,
              "currentPrice": 110,
              "purchaseFxRate": 85,
              "currentFxRate": 83
            }
            """;

        mockMvc.perform(post("/api/fx/attribution")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.originalValue").value(8500.0))
            .andExpect(jsonPath("$.currentValue").value(9130.0))
            .andExpect(jsonPath("$.assetImpact").value(850.0))
            .andExpect(jsonPath("$.fxImpact").value(-220.0))
            .andExpect(jsonPath("$.netChange").value(630.0))
            .andExpect(jsonPath("$.returnPercent").value(7.4118));
    }

    @Test
    void negativeQuantityReturnsBadRequest() throws Exception {
        String json = """
            {
              "quantity": -1,
              "purchasePrice": 100,
              "currentPrice": 110,
              "purchaseFxRate": 85,
              "currentFxRate": 83
            }
            """;

        mockMvc.perform(post("/api/fx/attribution")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isBadRequest());
    }

    @Test
    void missingQuantityReturnsBadRequest() throws Exception {
        String json = """
            {
              "purchasePrice": 100,
              "currentPrice": 110,
              "purchaseFxRate": 85,
              "currentFxRate": 83
            }
            """;

        mockMvc.perform(post("/api/fx/attribution")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isBadRequest());
    }
}
