import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()

    stack = []
    line_num = 1
    col_num = 0
    
    # We'll just count div tags and basic brackets for simplicity
    div_open = content.count('<div ') + content.count('<div>')
    div_close = content.count('</div>')
    
    paren_open = content.count('(')
    paren_close = content.count(')')
    
    brace_open = content.count('{')
    brace_close = content.count('}')
    
    bracket_open = content.count('[')
    bracket_close = content.count(']')
    
    print(f"Results for {filename}:")
    print(f"Divs: Open={div_open}, Close={div_close}, Diff={div_open - div_close}")
    print(f"Parens: Open={paren_open}, Close={paren_close}, Diff={paren_open - paren_close}")
    print(f"Braces: Open={brace_open}, Close={brace_close}, Diff={brace_open - brace_close}")
    print(f"Brackets: Open={bracket_open}, Close={bracket_close}, Diff={bracket_open - bracket_close}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check_balance(sys.argv[1])
