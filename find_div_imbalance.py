
import re

def check_div_balance(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Match <div or </div (ignoring space inside the tag like </div >)
        # We need to be careful with nested components like <div...><div...></div></div>
        tokens = re.findall(r'<div|</div\s*>', line)
        for token in tokens:
            if token.startswith('<div') and not token.startswith('</'):
                stack.append(line_num)
            else:
                if stack:
                    stack.pop()
                else:
                    print(f"Extra closing div at line {line_num}")
    
    for line_num in stack:
        print(f"Unclosed opening div at line {line_num}")

if __name__ == "__main__":
    check_div_balance('/Volumes/T5c_1TB/BanKisha/app/dashboard/interviews/new/page.tsx')
