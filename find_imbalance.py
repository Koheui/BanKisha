
import re

def check_balance(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Div check
    stack_div = []
    # Parenthesis check
    stack_paren = []
    
    # We need to scan the whole content
    # I'll use a simple scanner for demonstration
    import tokenize
    from io import BytesIO

    # Tokenizer might be overkill and complex for JSX
    # I'll stick to regex but with index tracking
    
    # Find all <div, </div, (, )
    matches = re.finditer(r'<div|</div\s*>|\(|\)', content)
    
    for match in matches:
        token = match.group()
        line_num = content.count('\n', 0, match.start()) + 1
        
        if token == '<div':
            stack_div.append(line_num)
        elif token.startswith('</div'):
            if stack_div:
                stack_div.pop()
            else:
                print(f"Extra closing div at line {line_num}")
        elif token == '(':
            stack_paren.append(line_num)
        elif token == ')':
            if stack_paren:
                stack_paren.pop()
            else:
                print(f"Extra closing parenthesis at line {line_num}")
                
    for ln in stack_div:
        print(f"Unclosed opening div at line {ln}")
    for ln in stack_paren:
        print(f"Unclosed opening parenthesis at line {ln}")

if __name__ == "__main__":
    check_balance('/Volumes/T5c_1TB/BanKisha/app/dashboard/interviews/new/page.tsx')
