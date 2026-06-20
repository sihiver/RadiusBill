import sys
import json
import os
from datetime import datetime

def parse_sql_values(sql_line):
    """ Parses a MariaDB INSERT statement's VALUES part using a state machine """
    # Find where VALUES starts
    idx = sql_line.find("VALUES ")
    if idx == -1:
        return []
    
    data_str = sql_line[idx + 7:]
    
    values = []
    in_string = False
    escape = False
    current_tuple = []
    current_val = []
    in_tuple = False
    
    for char in data_str:
        if escape:
            current_val.append(char)
            escape = False
            continue
            
        if char == '\\':
            escape = True
            # we don't append '\' because we want the unescaped char, but for simplicity let's just keep it 
            # to know it was escaped, or better just keep the literal string format.
            current_val.append(char)
            continue
            
        if char == "'":
            in_string = not in_string
            # do not append the quote itself if we want clean data, but let's append it and strip later
            current_val.append(char)
            continue
            
        if in_string:
            current_val.append(char)
            continue
            
        if char == '(':
            if not in_tuple:
                in_tuple = True
                current_val = []
                current_tuple = []
                continue
            
        if char == ')':
            if in_tuple:
                in_tuple = False
                current_tuple.append(''.join(current_val).strip())
                values.append(current_tuple)
                current_val = []
                continue
            
        if char == ',':
            if in_tuple:
                current_tuple.append(''.join(current_val).strip())
                current_val = []
            continue
            
        if in_tuple:
            current_val.append(char)
            
    # Clean the values (remove surrounding quotes and handle NULL)
    cleaned_values = []
    for t in values:
        clean_t = []
        for v in t:
            if v == 'NULL':
                clean_t.append(None)
            elif v.startswith("'") and v.endswith("'"):
                # Remove quotes and unescape
                val = v[1:-1].replace("\\'", "'").replace('\\\\', '\\')
                clean_t.append(val)
            else:
                clean_t.append(v)
        cleaned_values.append(clean_t)
        
    return cleaned_values

def main():
    dump_file = '../migrasidb/radius_backup_2026-06-20T04-24-28.sql'
    out_file = 'migrasi_vouchers.json'
    
    if not os.path.exists(dump_file):
        print(f"File not found: {dump_file}")
        sys.exit(1)
        
    print("Mengekstrak data dari SQL dump...")
    
    groups = {}
    vouchers = []
    
    with open(dump_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if line.startswith("INSERT INTO `rm_groups`"):
                parsed = parse_sql_values(line)
                for row in parsed:
                    if len(row) >= 10:
                        group_id = row[0]
                        name = row[1]
                        price = row[8]
                        selling_price = row[9]
                        groups[str(group_id)] = {
                            "name": name,
                            "price": selling_price if selling_price and selling_price != '0.00' else price
                        }
            
            elif line.startswith("INSERT INTO `rm_vouchers`"):
                parsed = parse_sql_values(line)
                for row in parsed:
                    if len(row) >= 9:
                        # Schema: id, code, group_id, created_at, valid_until, used_at, used_by, data_limit, is_active
                        v_id = row[0]
                        code = row[1]
                        group_id = str(row[2])
                        created_at = row[3]
                        valid_until = row[4]
                        used_at = row[5]
                        is_active = row[8]
                        
                        # Filter for Unused and Active
                        # is_active == '1'
                        if is_active == '1':
                            status = None
                            
                            if used_at is None:
                                status = 'Unused'
                            else:
                                # Check if valid_until is in the future
                                if valid_until is not None:
                                    try:
                                        vu_dt = datetime.strptime(valid_until, '%Y-%m-%d %H:%M:%S')
                                        if vu_dt > datetime.now():
                                            status = 'Active'
                                    except Exception:
                                        pass
                                        
                            if status:
                                vouchers.append({
                                    "code": code,
                                    "group_id": group_id,
                                    "status": status,
                                    "valid_until": valid_until,
                                    "used_at": used_at
                                })

    print(f"Berhasil mengekstrak {len(groups)} paket (groups).")
    print(f"Berhasil mengekstrak {len(vouchers)} voucher (Unused/Active).")
    
    # Map vouchers to group details
    mapped_vouchers = []
    for v in vouchers:
        g_info = groups.get(v['group_id'], {"name": "Unknown", "price": 0})
        v['package_name'] = g_info['name']
        v['package_price'] = g_info['price']
        mapped_vouchers.append(v)
        
    with open(out_file, 'w') as f:
        json.dump({
            "groups": groups,
            "vouchers": mapped_vouchers
        }, f, indent=2)
        
    print(f"Data tersimpan di {out_file}")

if __name__ == '__main__':
    main()
