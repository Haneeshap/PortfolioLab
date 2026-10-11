
package com.portfoliolab.backend.market;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Arrays;
import java.util.List;

@Service
public class MarketService {

    private final RestClient restClient;

    public MarketService() {
    this.restClient = RestClient.builder()
            .baseUrl("http://127.0.0.1:8081")
            .build();
}
    public List<MarketPrice> getCurrentPrices() {
        try {
            MarketPrice[] prices = restClient.get()
                    .uri("/prices")
                    .retrieve()
                    .body(MarketPrice[].class);

            if (prices == null) {
                throw new IllegalStateException(
                        "Market simulator returned an empty response"
                );
            }

            return Arrays.asList(prices);

        } catch (RestClientException exception) {
            throw new MarketServiceUnavailableException(
                    "Unable to retrieve simulated market prices",
                    exception
            );
        }
    }
}
