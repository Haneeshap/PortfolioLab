import sys

# Read the file
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep only first 63 lines
kept = lines[:63]

# Write back
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.writelines(kept)

print(f"Truncated {sys.argv[1]} to {len(kept)} lines")