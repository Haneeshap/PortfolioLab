with open('app/api/routes/assets.py', 'r') as f:
    lines = f.readlines()
print(f'Total lines: {len(lines)}')
truncated = lines[:63]
with open('app/api/routes/assets.py', 'w') as f:
    f.writelines(truncated)
print(f'Truncated to {len(truncated)} lines')