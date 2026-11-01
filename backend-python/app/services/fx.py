# PortfolioLab FX Service - Simplified
# Single convert function using reference rates, no asset-price-ratio complexity


from decimal import Decimal
from typing import Optional


# Reference FX rates (base currency -> quote currency)
# In production, these would come from a central bank API or FX desk
# Here we use simple reference rates for major currencies
REFERENCE_RATES = {
    "USD": {"USD": Decimal("1"), "EUR": Decimal("0.85"), "GBP": Decimal("0.73"), "JPY": Decimal("155"), "INR": Decimal("83"), "CAD": Decimal("1.35")},
    "EUR": {"USD": Decimal("1.18"), "EUR": Decimal("1"), "GBP": Decimal("0.86"), "JPY": Decimal("183"), "INR": Decimal("98"), "CAD": Decimal("1.60")},
    "GBP": {"USD": Decimal("1.37"), "EUR": Decimal("1.16"), "GBP": Decimal("1"), "JPY": Decimal("212"), "INR": Decimal("114"), "CAD": Decimal("1.85")},
    "JPY": {"USD": Decimal("0.0065"), "EUR": Decimal("0.0055"), "GBP": Decimal("0.0047"), "JPY": Decimal("1"), "INR": Decimal("0.54"), "CAD": Decimal("0.0087")},
    "INR": {"USD": Decimal("0.012"), "EUR": Decimal("0.0102"), "GBP": Decimal("0.0088"), "JPY": Decimal("1.85"), "INR": Decimal("1"), "CAD": Decimal("0.0163")},
    "CAD": {"USD": Decimal("0.74"), "EUR": Decimal("0.63"), "GBP": Decimal("0.54"), "JPY": Decimal("115"), "INR": Decimal("61"), "CAD": Decimal("1")},
}


def convert(amount: float, from_currency: str, to_currency: str) -> dict[str, any]:
    """
    Convert amount from one currency to another using reference rates.
    
    Args:
        amount: The amount to convert
        from_currency: The source currency symbol (e.g., "USD")
        to_currency: The target currency symbol (e.g., "EUR")
    
    Returns:
        Dictionary with conversion result
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    if from_currency == to_currency:
        return {
            "from_symbol": from_currency,
            "to_symbol": to_currency,
            "amount": amount,
            "converted_amount": float(amount),
            "rate": 1.0,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    # Get reference rate: from_currency -> USD -> to_currency
    # First convert from_currency to USD, then USD to to_currency
    from_usd = REFERENCE_RATES.get(from_currency, {})
    to_usd = REFERENCE_RATES.get(to_currency, {})
    
    # Get rate from from_currency to USD (1/from_usd[to_currency] logic handled below)
    # If we have from_currency rates, get USD rate; if we have to_currency rates, get inverse
    
    if from_currency in REFERENCE_RATES and "USD" in REFERENCE_RATES[from_currency]:
        from_to_usd = REFERENCE_RATES[from_currency]["USD"]
    else:
        from_to_usd = Decimal("1") / to_usd.get("USD", Decimal("1"))
    
    if to_currency in REFERENCE_RATES and "USD" in REFERENCE_RATES[to_currency]:
        to_from_usd = REFERENCE_RATES[to_currency]["USD"]
    else:
        to_from_usd = Decimal("1") / from_usd.get("USD", Decimal("1"))
    
    conversion_rate = to_from_usd / from_to_usd
    converted_amount = Decimal(str(amount)) * conversion_rate
    
    return {
        "from_symbol": from_currency,
        "to_symbol": to_currency,
        "amount": amount,
        "converted_amount": float(converted_amount.quantize(Decimal("0.0001"))),
        "rate": float(conversion_rate.quantize(Decimal("0.0001"))),
        "timestamp": datetime.utcnow().isoformat(),
    }