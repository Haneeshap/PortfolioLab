import urllib.request
import os

url = 'https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64.exe'
local_path = r'C:\Users\hanee\projects2026\PortfolioLab\backend-python\pg_installer.exe'

try:
    urllib.request.urlretrieve(url, local_path)
    print(f"Downloaded to {local_path}")
except Exception as e:
    print(f"Download failed: {e}")