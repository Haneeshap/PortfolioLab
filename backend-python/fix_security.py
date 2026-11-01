# Fix security.py imports
with open('app\\core\\security.py', 'r') as f:
    content = f.read()

# Add get_async_session import after the CryptContext import line
if 'from passlib.context import CryptContext' in content and 'from app.core.database import get_async_session' not in content:
    content = content.replace(
        'from passlib.context import CryptContext',
        'from passlib.context import CryptContext\nfrom app.core.database import get_async_session'
    )
    with open('app\\core\\security.py', 'w') as f:
        f.write(content)
    print('Added get_async_session import')
else:
    print('Import already exists or not found')