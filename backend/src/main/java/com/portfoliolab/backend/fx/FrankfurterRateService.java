package com.portfoliolab.backend.fx;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;

@Service
public class FrankfurterRateService {

    private static final String BASE_URL =
            "https://api.frankfurter.dev/v2";

    private final RestClient client = RestClient.builder()
            .baseUrl(BASE_URL)
            .build();

    public ExchangeRate getLatestRate(String from, String to) {
        return getRate(from, to, null);
    }

    public ExchangeRate getHistoricalRate(
            String from,
            String to,
            LocalDate date
    ) {
        return getRate(from, to, date);
    }

    private ExchangeRate getRate(
            String from,
            String to,
            LocalDate date
    ) {
        String base = from.trim().toUpperCase(Locale.ROOT);
        String quote = to.trim().toUpperCase(Locale.ROOT);

        if (base.equals(quote)) {
            return new ExchangeRate(
                    date != null ? date : LocalDate.now(),
                    base,
                    quote,
                    BigDecimal.ONE
            );
        }

        FrankfurterResponse response = client.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path(
                            "/rate/{base}/{quote}"
                    );

                    if (date != null) {
                        builder.queryParam("date", date);
                    }

                    return builder.build(base, quote);
                })
                .retrieve()
                .body(FrankfurterResponse.class);

        if (response == null ||
                response.date() == null ||
                response.rate() == null) {
            throw new IllegalStateException(
                    "Exchange rate provider returned incomplete data"
            );
        }

        return new ExchangeRate(
                response.date(),
                base,
                quote,
                response.rate()
        );
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record FrankfurterResponse(
            LocalDate date,
            BigDecimal rate
    ) {}

    public record ExchangeRate(
            LocalDate date,
            String base,
            String quote,
            BigDecimal rate
    ) {}
}