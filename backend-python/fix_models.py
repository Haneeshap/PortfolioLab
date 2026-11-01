# Fix TIMESTAMPTZ in model files - replace with DateTime(timezone=True)

import os
import re

backend = r'c:\Users\hanee\projects2026\PortfolioLab\backend-python'

model_files = [
    'app/models/portfolio.py',
    'app/models/simulated_order.py',
    'app/models/notification.py',
    'app/models/fx_rate.py',
]

for fname in model_files:
    path = os.path.join(backend, fname)
    if not os.path.exists(path):
        continue
    with open(path, 'r') as f:
        content = f.read()
    # Replace TIMESTAMPTZ import and usages
    content = content.replace('TIMESTAMPTZ', 'DateTime')
    # Replace Column(TIMESTAMPTZ, with Column(DateTime(timezone=True),
    content = content.replace('Column(TIMESTAMPTZ,', 'Column(DateTime(timezone=True),')
    with open(path, 'w') as f:
        f.write(content)
    print(f'Fixed {fname}')

print('All model files fixed')