package com.portfoliolab.backend.dividend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ScheduledDividendScheduler {
    private static final Logger log = LoggerFactory.getLogger(ScheduledDividendScheduler.class);
    private final ScheduledDividendService service;

    public ScheduledDividendScheduler(ScheduledDividendService service) { this.service = service; }

    @Scheduled(fixedDelay = 10000, initialDelay = 10000)
    public void processDue() {
        for (Long scheduleId : service.dueScheduleIds()) {
            for (Long portfolioId : service.candidatePortfolioIds(scheduleId)) {
                try {
                    String status = service.creditIfEligible(scheduleId, portfolioId);
                    if ("CREDITED".equals(status)) {
                        log.info("Scheduled dividend credited: schedule={}, portfolio={}", scheduleId, portfolioId);
                    }
                } catch (Exception e) {
                    log.error("Scheduled dividend failed: schedule={}, portfolio={}", scheduleId, portfolioId, e);
                }
            }
        }
    }
}
