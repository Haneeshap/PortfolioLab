package com.portfoliolab.backend.risk;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class PortfolioTradeRiskListener {
    private static final Logger log = LoggerFactory.getLogger(PortfolioTradeRiskListener.class);
    private final PortfolioRiskAgent agent;
    private final TransactionTemplate newTransaction;

    public PortfolioTradeRiskListener(PortfolioRiskAgent agent, PlatformTransactionManager transactionManager) {
        this.agent = agent;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTradeCommitted(PortfolioTradeCommitted event) {
        try {
            var result = newTransaction.execute(status -> agent.analyze(event.portfolioId()));
            log.info("Automatic risk analysis for portfolio {}: {}", event.portfolioId(), result);
        } catch (Exception exception) {
            // A risk analysis failure must not reverse an already committed trade.
            log.error("Automatic risk analysis failed for portfolio {}", event.portfolioId(), exception);
        }
    }
}