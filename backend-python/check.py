import ast
f = open('app/main.py').read()
ast.parse(f)
print('OK')