
package com.portfoliolab.backend.market;

public class MarketServiceUnavailableException extends RuntimeException {

    public MarketServiceUnavailableException(
            String message,
            Throwable cause
    ) {
        super(message, cause);
    }
}
