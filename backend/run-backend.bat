@echo off
set DB_PASSWORD=PortfolioLabLocalDev2026
cd /d c:\Users\hanee\projects2026\PortfolioLab\backend
call .\mvnw.cmd spring-boot:run > run.log 2>&1