import os

base = os.path.dirname(os.path.abspath(__file__))
for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d != '__pycache__']
    for f in files:
        if f.endswith('.py'):
            path = os.path.join(root, f)
            try:
                with open(path, 'rb') as fh:
                    data = fh.read()
                null_count = data.count(b'\x00')
                if null_count > 0:
                    print(f'NULL BYTES in {path}: {null_count} - FIXING')
                    cleaned = data.replace(b'\x00', b'')
                    with open(path, 'wb') as fh:
                        fh.write(cleaned)
                    print(f'  Fixed: removed {null_count} null bytes')
                else:
                    print(f'OK: {path}')
            except Exception as e:
                print(f'ERROR reading {path}: {e}')