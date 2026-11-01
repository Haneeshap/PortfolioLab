from sqlalchemy import create_engine
engine = create_engine("postgresql://portfoliolab:PortfolioLabLocalDev2026@localhost:5432/portfoliolab")
try:
    with engine.connect() as conn:
        conn.execute("SELECT 1")
    print("Connection successful")
except Exception as e:
    print(f"Connection failed: {e}")