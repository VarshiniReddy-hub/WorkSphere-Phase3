
from getpass import getpass
from sqlalchemy import text
from app.database import engine
from app.security import hash_password

username = input("Enter username: ").strip()
password = getpass("Enter your new password: ")

if len(password) < 8:
    print("Password must be at least 8 characters.")
    raise SystemExit(1)

with engine.begin() as connection:
    user = connection.execute(
        text("SELECT id FROM users WHERE username = :username"),
        {"username": username},
    ).fetchone()

    if user is None:
        print(f"User '{username}' not found. No changes made.")
    else:
        connection.execute(
            text("""
                UPDATE users
                SET hashed_password = :hashed_password
                WHERE username = :username
            """),
            {
                "hashed_password": hash_password(password),
                "username": username,
            },
        )
        print(f"Password reset successfully for {username}.")
