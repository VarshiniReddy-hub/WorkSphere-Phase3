import sqlite3

connection = sqlite3.connect("worksphere.db")

print("Users table columns:")
for column in connection.execute("PRAGMA table_info(users)").fetchall():
    print(column[1], "-", column[2])

print("\nExisting users (passwords excluded):")
try:
    columns = [row[1] for row in connection.execute("PRAGMA table_info(users)")]
    safe_columns = [name for name in ("id", "username", "email", "role", "is_active") if name in columns]
    if safe_columns:
        query = "SELECT " + ", ".join('"' + name + '"' for name in safe_columns) + " FROM users"
        for user in connection.execute(query).fetchall():
            print(user)
except sqlite3.Error as error:
    print("Could not list users:", error)

connection.close()
