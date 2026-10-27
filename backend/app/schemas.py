from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

Role = Literal["EMPLOYEE", "HR", "ADMIN"]
class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=120)

class AdminUserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role = "EMPLOYEE"
    full_name: str = Field(min_length=2, max_length=120)

class AdminUserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    salary: Optional[float] = Field(default=None, ge=0)

class LeavePolicyIn(BaseModel):
    leave_type: Literal["SICK", "CASUAL", "PAID"]
    total_days_allowed: int = Field(ge=0, le=365)

class LoginIn(BaseModel):
    username: str
    password: str
    # The selected role is a login-time check, not a way to grant privileges.
    role: Role

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)

class EmployeeIn(BaseModel):
    user_id: int
    full_name: str
    designation: str = "Employee"
    department: str = "General"
    joining_date: date
    salary: float = Field(ge=0)
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    joining_date: Optional[date] = None
    salary: Optional[float] = Field(default=None, ge=0)
    status: Optional[Literal["ACTIVE", "INACTIVE"]] = None

class EmployeeOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    designation: str
    department: str
    joining_date: date
    salary: float
    status: str
    model_config = ConfigDict(from_attributes=True)

class LeaveIn(BaseModel):
    leave_type: Literal["SICK", "CASUAL", "PAID"]
    start_date: date
    end_date: date
    reason: str = Field(min_length=3, max_length=1000)
    @model_validator(mode="after")
    def valid_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self

class LeaveDecision(BaseModel):
    status: Literal["APPROVED", "REJECTED"]

class PayrollIn(BaseModel):
    employee_id: int
    basic_salary: float = Field(ge=0)
    allowances: float = Field(default=0, ge=0)
    deductions: float = Field(default=0, ge=0)
    bonus: float = Field(default=0, ge=0)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")

class CheckInOut(BaseModel):
    pass
