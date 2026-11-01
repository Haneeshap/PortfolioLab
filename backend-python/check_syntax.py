import ast
with open('app/api/routes/assets.py', 'r', encoding='utf-8') as f:
    code = f.read()
try:
    ast.parse(code)
    print('Syntax OK')
except SyntaxError as e:
    print(f'Syntax Error: {e}')