@echo off
rem PortfolioLab Python backend - drop-in replacement for the Java Spring Boot backend
rem Sets DB_PASSWORD (must match the Docker Compose PostgreSQL password) and runs uvicorn.
set DB_PASSWORD=PortfolioLabLocalDev2026
cd /d c:\Users\hanee\projects2026\PortfolioLab\backend-python
uvicorn app.main:app --reload --port 8000
