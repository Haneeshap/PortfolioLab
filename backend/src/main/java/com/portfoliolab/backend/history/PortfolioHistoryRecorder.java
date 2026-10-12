package com.portfoliolab.backend.history;

import com.portfoliolab.backend.market.MarketPrice;
import com.portfoliolab.backend.market.MarketService;
import com.portfoliolab.backend.portfolio.Holding;
import com.portfoliolab.backend.portfolio.HoldingRepository;
import com.portfoliolab.backend.portfolio.Portfolio;
import com.portfoliolab.backend.portfolio.PortfolioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PortfolioHistoryRecorder {
    private static final Logger log =
            LoggerFactory.getLogger(PortfolioHistoryRecorder.class);

    private final PortfolioRepository portfolios;
    private final HoldingRepository holdings;
    private final MarketService market;
    private final JdbcTemplate jdbc;

    public PortfolioHistoryRecorder(
            PortfolioRepository portfolios,
            HoldingRepository holdings,
            MarketService market,
            JdbcTemplate jdbc
    ) {
        this.portfolios = portfolios;
        this.holdings = holdings;
        this.market = market;
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelay = 30000, initialDelay = 5000)
    public void record() {
        List<Portfolio> allPortfolios = portfolios.findAll();

        if (allPortfolios.isEmpty()) {
            return;
        }

        Map<String, MarketPrice> quotes;
        try {
            quotes = market.getCurrentPrices().stream()
                    .collect(Collectors.toMap(
                            MarketPrice::symbol,
                            Function.identity(),
                            (first, second) -> second
                    ));
        } catch (Exception exception) {
            log.warn("Skipping history snapshot: market unavailable");
            return;
        }

        for (Portfolio portfolio : allPortfolios) {
            try {
                recordPortfolio(portfolio, quotes);
            } catch (Exception exception) {
                log.warn(
                        "Could not record portfolio {}: {}",
                        portfolio.getId(),
                        exception.getMessage()
                );
            }
        }
    }

    private void recordPortfolio(
            Portfolio portfolio,
            Map<String, MarketPrice> quotes
    ) {
        List<Holding> positions =
                holdings.findByPortfolioId(portfolio.getId());

        BigDecimal holdingsValue = BigDecimal.ZERO;

        for (Holding holding : positions) {
            String symbol = holding.getAsset().getSymbol();
            String currency = holding.getAsset().getCurrency();

            MarketPrice quote = quotes.get(symbol);

            if (quote == null
                    || quote.price() == null
                    || quote.price().signum() <= 0
                    || !currency.equals(quote.currency())
                    || !portfolio.getCurrency().equals(currency)) {
                log.warn(
                        "Skipping snapshot for portfolio {}: invalid or missing quote for {}",
                        portfolio.getId(),
                        symbol
                );
                return;
            }

            holdingsValue = holdingsValue.add(
                    holding.getQuantity().multiply(quote.price())
            );
        }

        BigDecimal cash = portfolio.getCashBalance();
        BigDecimal total = cash.add(holdingsValue);

        jdbc.update("""
                INSERT INTO portfolio_snapshots
                (portfolio_id, cash_balance, holdings_value,
                 total_value, currency, valuation_source)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                portfolio.getId(),
                cash,
                holdingsValue.setScale(4, RoundingMode.HALF_UP),
                total.setScale(4, RoundingMode.HALF_UP),
                portfolio.getCurrency(),
                "GO_SIMULATOR"
        );
    }
}
