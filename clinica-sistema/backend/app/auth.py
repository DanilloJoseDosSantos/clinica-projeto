def authenticate_user(username: str, password: str) -> bool:
    return username == "admin" and password == "admin"
