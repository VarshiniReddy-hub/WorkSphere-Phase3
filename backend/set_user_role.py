
import sqlite3

DB_PATH = "worksphere.db"

username = input("Enter username: ").strip()
role = input("Enter role (EMPLOYEE, HR, ADMIN): ").strip().upper()

if role not in {"EMPLOYEE", "HR", "ADMIN"}:
    print("Invalid role. No changes made.")
    raise SystemExit(1)

with sqlite3.connect(DB_PATH) as connection:
    user = connection.execute(
        "SELECT username, role FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    if user is None:
        print("User not found.")
    else:
        print("Current account:", user)
        confirm = input("Type YES to confirm: ").strip()

        if confirm == "YES":
            connection.execute(
                "UPDATE users SET role = ? WHERE username = ?",
                (role, username)
            )
            print(f"{username} updated to {role}.")
        else:
            print("Cancelled.")
