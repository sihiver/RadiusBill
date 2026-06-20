import sys
import json
import os
from datetime import datetime

def parse_sql_values(sql_line):
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
            current_val.append(char)
            continue
        if char == "'":
            in_string = not in_string
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
            
    cleaned_values = []
    for t in values:
        clean_t = []
        for v in t:
            if v == 'NULL':
                clean_t.append(None)
            elif v.startswith("'") and v.endswith("'"):
                val = v[1:-1].replace("\\'", "'").replace('\\\\', '\\')
                clean_t.append(val)
            else:
                clean_t.append(v)
        cleaned_values.append(clean_t)
        
    return cleaned_values

def main():
    dump_file = '../migrasidb/radius_backup_2026-06-20T04-24-28.sql'
    out_file = 'migrasi_pppoe.json'
    
    print("Mengekstrak data PPPoE dari SQL dump...")
    groups = {}
    pppoe = []
    passwords = {}
    
    with open(dump_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if line.startswith("INSERT INTO `rm_groups`"):
                parsed = parse_sql_values(line)
                for row in parsed:
                    if len(row) >= 10:
                        groups[str(row[0])] = {
                            "name": row[1],
                            "price": row[9] if row[9] and row[9] != '0.00' else row[8]
                        }
            
            # rm_pppoe_passwords holds passwords!
            # id, pppoe_user_id, password
            elif line.startswith("INSERT INTO `rm_pppoe_passwords`"):
                 parsed = parse_sql_values(line)
                 for row in parsed:
                     if len(row) >= 3:
                         passwords[str(row[1])] = row[2]

            elif line.startswith("INSERT INTO `rm_pppoe_users`"):
                parsed = parse_sql_values(line)
                for row in parsed:
                    if len(row) >= 10:
                        # Schema: id, username, name, address, phone, email, group_id, created_at, valid_until, is_active, is_isolated, ...
                        m_id = str(row[0])
                        username = row[1]
                        name = row[2]
                        group_id = str(row[6])
                        valid_until = row[8]
                        is_active = row[9]
                        
                        if is_active == '1':
                            if valid_until is not None:
                                try:
                                    vu_dt = datetime.strptime(valid_until, '%Y-%m-%d %H:%M:%S')
                                    if vu_dt > datetime.now():
                                        pppoe.append({
                                            "member_id": m_id,
                                            "username": username,
                                            "name": name,
                                            "group_id": group_id,
                                            "valid_until": valid_until
                                        })
                                except Exception:
                                    pass

    print(f"Berhasil mengekstrak {len(pppoe)} PPPoE aktif.")
    
    mapped = []
    for m in pppoe:
        g_info = groups.get(m['group_id'], {"name": "Unknown", "price": 0})
        m['package_name'] = g_info['name']
        m['package_price'] = g_info['price']
        m['password'] = passwords.get(m['member_id'], '123456') # fallback
        mapped.append(m)
        
    with open(out_file, 'w') as f:
        json.dump({
            "groups": groups,
            "pppoe": mapped
        }, f, indent=2)
        
    print(f"Data PPPoE tersimpan di {out_file}")

if __name__ == '__main__':
    main()
