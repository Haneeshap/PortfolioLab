package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "transaction_type", nullable = false, length = 4)
    private String transactionType;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal quantity;

    @Column(name = "price_per_unit", nullable = false, precision = 19, scale = 4)
    private BigDecimal pricePerUnit;

    @Column(name = "total_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @Column(name = "execution_fx_rate", nullable = false, precision = 19, scale = 8)
private BigDecimal executionFxRate;

@Column(name = "portfolio_amount", nullable = false, precision = 19, scale = 4)
private BigDecimal portfolioAmount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected Transaction() {
    }

   public Transaction(
        Portfolio portfolio,
        Asset asset,
        String transactionType,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal totalAmount,
        String currency,
        BigDecimal executionFxRate,
        BigDecimal portfolioAmount
) {
    this.portfolio = portfolio;
    this.asset = asset;
    this.transactionType = transactionType;
    this.quantity = quantity;
    this.pricePerUnit = pricePerUnit;
    this.totalAmount = totalAmount;
    this.currency = currency;
    this.executionFxRate = executionFxRate;
    this.portfolioAmount = portfolioAmount;
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

    public String getTransactionType() {
        return transactionType;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public BigDecimal getPricePerUnit() {
        return pricePerUnit;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public String getCurrency() {
        return currency;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
public BigDecimal getExecutionFxRate() {
    return executionFxRate;
}

public BigDecimal getPortfolioAmount() {
    return portfolioAmount;
}
}