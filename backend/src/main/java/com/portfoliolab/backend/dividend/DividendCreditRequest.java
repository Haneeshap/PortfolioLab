package com.portfoliolab.backend.dividend;

import java.math.BigDecimal;
public record DividendCreditRequest(Long assetId, String referenceKey,
                                    BigDecimal dividendPerShare, String currency) {}