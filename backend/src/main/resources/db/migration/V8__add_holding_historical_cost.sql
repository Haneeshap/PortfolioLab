ALTER TABLE holdings
    ADD COLUMN historical_cost_portfolio NUMERIC(19,4);

DO $$
DECLARE
    h RECORD;
    t RECORD;
    running_quantity NUMERIC;
    running_cost NUMERIC;
BEGIN
    FOR h IN
        SELECT id, portfolio_id, asset_id, quantity
        FROM holdings
        ORDER BY id
    LOOP
        running_quantity := 0;
        running_cost := 0;

        FOR t IN
            SELECT transaction_type, quantity, portfolio_amount
            FROM transactions
            WHERE portfolio_id = h.portfolio_id
              AND asset_id = h.asset_id
            ORDER BY created_at ASC, id ASC
        LOOP
            IF t.transaction_type = 'BUY' THEN
                running_quantity := running_quantity + t.quantity;
                running_cost := running_cost + t.portfolio_amount;

            ELSIF t.transaction_type = 'SELL' THEN
                IF t.quantity > running_quantity THEN
                    RAISE EXCEPTION
                        'SELL exceeds position for holding %', h.id;
                END IF;

                IF t.quantity = running_quantity THEN
                    running_quantity := 0;
                    running_cost := 0;
                ELSE
                    running_cost := running_cost *
                        (running_quantity - t.quantity) /
                        running_quantity;

                    running_quantity := running_quantity - t.quantity;
                END IF;
            ELSE
                RAISE EXCEPTION
                    'Unknown transaction type for holding %', h.id;
            END IF;
        END LOOP;

        IF running_quantity <> h.quantity THEN
            RAISE EXCEPTION
                'History quantity mismatch for holding %', h.id;
        END IF;

        IF running_quantity <= 0 THEN
            RAISE EXCEPTION
                'Invalid remaining quantity for holding %', h.id;
        END IF;

        UPDATE holdings
        SET historical_cost_portfolio = ROUND(running_cost, 4)
        WHERE id = h.id;
    END LOOP;
END $$;

ALTER TABLE holdings
    ALTER COLUMN historical_cost_portfolio SET NOT NULL;

ALTER TABLE holdings
    ADD CONSTRAINT chk_holding_historical_cost_nonnegative
    CHECK (historical_cost_portfolio >= 0);