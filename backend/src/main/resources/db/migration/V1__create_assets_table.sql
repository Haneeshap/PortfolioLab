CREATE TABLE assets (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    price NUMERIC(19, 4) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL
);
