import subprocess
import os

# Check common PostgreSQL installation paths
paths_to_check = [
    r"C:\Program Files\PostgreSQL",
    r"C:\Program Files (x86)\PostgreSQL",
    r"C:\ProgramData\PostgreSQL",
]

for base_path in paths_to_check:
    if os.path.exists(base_path):
        print(f"Found: {base_path}")
        # List directories ( PostgreSQL version folders )
        try:
            dirs = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d))]
            print(f"Versions: {dirs}")
        except:
            pass
    else:
        print(f"Not found: {base_path}")

# Check if pg_ctl or psql exists in PATH
result = subprocess.run(["where", "pg_ctl"], capture_output=True, text=True)
print(f"pg_ctl in PATH: {result.stdout if result.stdout else 'not found'}")

result = subprocess.run(["where", "psql"], capture_output=True, text=True)
print(f"psql in PATH: {result.stdout if result.stdout else 'not found'}")