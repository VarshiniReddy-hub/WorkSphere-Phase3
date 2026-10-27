
import sqlite3

connection = sqlite3.connect("worksphere.db")

try:
    user = connection.execute(
        "SELECT id, username, role FROM users WHERE username = ?",
        ("Varshini",)
    ).fetchone()

    if user is None:
        print("User Varshini not found.")
    else:
        connection.execute(
            "UPDATE users SET role = ? WHERE username = ?",
            ("ADMIN", "Varshini")
        )
        connection.commit()

        updated_user = connection.execute(
            "SELECT id, username, role, is_active FROM users WHERE username = ?",
            ("Varshini",)
        ).fetchone()

        print("Updated user:", updated_user)
finally:
    connection.close()
