package com.portfoliolab.backend.fx;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface FxRateRepository
        extends JpaRepository<FxRate, Long> {

    Optional<FxRate>
    findFirstByBaseCurrencyAndQuoteCurrencyOrderByCapturedAtDescIdDesc(
        String baseCurrency,
        String quoteCurrency
    );
}