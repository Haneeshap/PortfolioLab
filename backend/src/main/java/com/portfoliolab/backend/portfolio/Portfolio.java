
package com.portfoliolab.backend.portfolio;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "portfolios")
public class Portfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "cash_balance", nullable = false, precision = 19, scale = 4)
    private BigDecimal cashBalance;

    @Column(nullable = false, length = 3)
    private String currency;

    protected Portfolio() {
        // Required by JPA
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getCashBalance() {
        return cashBalance;
    }

    public String getCurrency() {
        return currency;
    }
public void setCashBalance(BigDecimal cashBalance) {
    if (cashBalance == null || cashBalance.signum() < 0) {
        throw new IllegalArgumentException(
                "Cash balance cannot be negative"
        );
    }

    this.cashBalance = cashBalance;
}
}
