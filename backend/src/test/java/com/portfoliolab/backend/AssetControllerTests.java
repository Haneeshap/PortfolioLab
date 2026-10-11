package com.portfoliolab.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AssetControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldReturnSeededAssets() throws Exception {
        mockMvc.perform(get("/api/assets"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(5))
            .andExpect(jsonPath("$[?(@.symbol == 'DEMO')]").exists())
            .andExpect(jsonPath("$[?(@.symbol == 'NOVA')]").exists());
    }
}