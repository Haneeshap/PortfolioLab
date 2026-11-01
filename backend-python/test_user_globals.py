import app.schemas.user as u
print("EmailStr in module globals:", "EmailStr" in u.__dict__)
print(u.UserCreate.__annotations__)