import sys
filepath = r'c:\Users\hanee\projects2026\PortfolioLab\backend-python\app\core\database.py'
with open(filepath, 'r') as f:
    content = f.read()
old = 'pool_pre_ping=True,'
new = 'pool_pre_ping=True,\n    pool_size=20,\n    max_overflow=10'
content = content.replace(old, new)
with open(filepath, 'w') as f:
    f.write(content)
print('Database pool optimization added')