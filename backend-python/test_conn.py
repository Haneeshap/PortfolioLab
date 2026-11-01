import asyncio
import asyncpg

async def test():
    try:
        conn = await asyncpg.connect("postgresql://portfoliolab:PortfolioLabLocalDev2026@localhost:5432/portfoliolab")
        print("Connection successful")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

asyncio.run(test())