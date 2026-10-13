
package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(
    name = "holdings",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"portfolio_id", "asset_id"}
    )
)
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal quantity;

    @Column(
        name = "average_buy_price",
        nullable = false,
        precision = 19,
        scale = 4
    )
    private BigDecimal averageBuyPrice;

    @Column(
        name = "historical_cost_portfolio",
        nullable = false,
        precision = 19,
        scale = 4
    )
    private BigDecimal historicalCostPortfolio;

    protected Holding() {
    }

    public Holding(
            Portfolio portfolio,
            Asset asset,
            BigDecimal quantity,
            BigDecimal averageBuyPrice
    ) {
        this.portfolio = portfolio;
        this.asset = asset;
        this.quantity = quantity;
        this.averageBuyPrice = averageBuyPrice;
        this.historicalCostPortfolio = quantity
                .multiply(averageBuyPrice)
                .setScale(4, java.math.RoundingMode.HALF_UP);
    }

    public BigDecimal getHistoricalCostPortfolio() {
        return historicalCostPortfolio;
    }

    public void setHistoricalCostPortfolio(BigDecimal value) {
        if (value == null || value.signum() < 0) {
            throw new IllegalArgumentException(
                "Historical cost must be nonnegative"
            );
        }
        this.historicalCostPortfolio = value.setScale(
                4, java.math.RoundingMode.HALF_UP
        );
    }

    public Long getId() {
        return id;
    }

    public Portfolio getPortfolio() {
        return portfolio;
    }

    public Asset getAsset() {
        return asset;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public BigDecimal getAverageBuyPrice() {
        return averageBuyPrice;
    }

    public void updatePosition(
            BigDecimal quantity,
            BigDecimal averageBuyPrice
    ) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new IllegalArgumentException(
                "Holding quantity must be positive"
            );
        }

        if (averageBuyPrice == null ||
                averageBuyPrice.signum() < 0) {
            throw new IllegalArgumentException(
                "Average buy price cannot be negative"
            );
        }

        this.quantity = quantity;
        this.averageBuyPrice = averageBuyPrice;
    }
}
