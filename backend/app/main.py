from io import BytesIO
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from datetime import datetime, date, time
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect, text
from apscheduler.schedulers.background import BackgroundScheduler
from .database import Base, engine, get_db
from . import models, schemas
from .security import hash_password, verify_password, create_access_token
from .dependencies import get_current_user, require_roles
from .phase3 import router as phase3_router

Base.metadata.create_all(bind=engine)
# Lightweight SQLite migration for databases created during Phase 1.
with engine.begin() as connection:
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "role" not in user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE'"))
    if "is_active" not in user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
    payroll_columns = {column["name"] for column in inspect(engine).get_columns("payroll")}
    if "allowances" not in payroll_columns:
        connection.execute(text("ALTER TABLE payroll ADD COLUMN allowances FLOAT NOT NULL DEFAULT 0"))
# Seed default leave policies on first startup; existing databases remain usable.
from .database import SessionLocal
_seed_db = SessionLocal()
try:
    for _kind, _days in (("SICK", 10), ("CASUAL", 12), ("PAID", 15)):
        if not _seed_db.query(models.LeavePolicy).filter_by(leave_type=_kind).first():
            _seed_db.add(models.LeavePolicy(leave_type=_kind, total_days_allowed=_days))
    _seed_db.flush()
    for _employee in _seed_db.query(models.Employee).all():
        for _policy in _seed_db.query(models.LeavePolicy).all():
            if not _seed_db.query(models.LeaveBalance).filter_by(employee_id=_employee.id, leave_type=_policy.leave_type).first():
                _seed_db.add(models.LeaveBalance(employee_id=_employee.id, leave_type=_policy.leave_type, remaining_days=_policy.total_days_allowed))
    _seed_db.commit()
except Exception:
    _seed_db.rollback()
finally:
    _seed_db.close()
# Default shift templates are inserted only when missing.
_seed_db = SessionLocal()
try:
    for _name, _start, _end in (("Morning", "09:00", "17:00"), ("Evening", "14:00", "22:00"), ("Night", "22:00", "06:00")):
        if not _seed_db.query(models.Shift).filter_by(name=_name).first():
            _seed_db.add(models.Shift(name=_name, start_time=_start, end_time=_end))
    _seed_db.commit()
except Exception:
    _seed_db.rollback()
finally:
    _seed_db.close()
app = FastAPI(title="WorkSphere HRMS API", version="3.0.0", description="WorkSphere HRMS with RBAC, attendance, leave policies, payroll, automation, documents, performance and analytics.")
app.include_router(phase3_router)

def automatic_absent_marking():
    """Mark absent after each assigned shift ends; use end-of-day for unassigned staff."""
    db = SessionLocal()
    try:
        now = datetime.now()
        today = now.date()
        for employee in db.query(models.Employee).filter_by(status="ACTIVE").all():
            assignment = db.query(models.EmployeeShift).filter_by(employee_id=employee.id).first()
            shift = db.query(models.Shift).filter_by(id=assignment.shift_id).first() if assignment else None
            attendance_date = today
            if shift:
                start_time = time.fromisoformat(shift.start_time)
                end_time = time.fromisoformat(shift.end_time)
                if end_time < start_time:  # overnight shift belongs to its start date
                    attendance_date = today if now.time() >= start_time else today - __import__("datetime").timedelta(days=1)
                    shift_end_date = attendance_date + __import__("datetime").timedelta(days=1)
                else:
                    shift_end_date = attendance_date
                end_at = datetime.combine(shift_end_date, end_time) + __import__("datetime").timedelta(minutes=10)
                if now < end_at:
                    continue
            else:
                if now.time() >= time(23, 45):
                    attendance_date = today
                elif now.time() < time(0, 15):
                    attendance_date = today - __import__("datetime").timedelta(days=1)
                else:
                    continue
            row = db.query(models.Attendance).filter_by(employee_id=employee.id, date=attendance_date).first()
            if not row:
                db.add(models.Attendance(employee_id=employee.id, date=attendance_date, status="ABSENT"))
                account = db.query(models.User).filter_by(id=employee.user_id).first()
                if account:
                    notify(db, account.id, "Attendance marked absent", f"No check-in was recorded for {attendance_date.isoformat()}.")
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

_scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_daily_absence_job():
    _scheduler.add_job(automatic_absent_marking, "interval", minutes=15, id="daily_absent_marking", replace_existing=True)
    if not _scheduler.running:
        _scheduler.start()

@app.on_event("shutdown")
def stop_daily_absence_job():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def notify(db, user_id, title, message):
    db.add(models.Notification(user_id=user_id, title=title, message=message))


def active_admin_count(db):
    """Return the number of active administrator accounts."""
    return db.query(models.User).filter_by(role="ADMIN", is_active=True).count()

def my_employee(db, user):
    employee = db.query(models.Employee).filter(models.Employee.user_id == user.id).first()
    if not employee:
        raise HTTPException(404, "Employee profile not found. Ask HR/Admin to create it.")
    return employee

@app.get("/")
def root():
    return {"message": "WorkSphere HRMS API is running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/api/auth/register", status_code=201)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    # Public registrations are always EMPLOYEE; HR/Admin roles must be assigned by an administrator.
    if db.query(models.User).filter((models.User.username == data.username) | (models.User.email == data.email)).first():
        raise HTTPException(409, "Username or email already exists")
    user = models.User(username=data.username, email=data.email, hashed_password=hash_password(data.password), role="EMPLOYEE")
    db.add(user); db.flush()
    employee = models.Employee(user_id=user.id, full_name=data.full_name, joining_date=date.today())
    db.add(employee); db.flush()
    for policy in db.query(models.LeavePolicy).all():
        db.add(models.LeaveBalance(employee_id=employee.id, leave_type=policy.leave_type, remaining_days=policy.total_days_allowed))
    db.commit(); db.refresh(user)
    return {"message": "Registration successful", "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role}}

@app.post("/api/auth/login")
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(401, "Incorrect username or password")
    if not user.is_active:
        raise HTTPException(403, "This account is deactivated. Contact an administrator.")
    if user.role != data.role:
        raise HTTPException(403, detail=f"This account is assigned the {user.role} role. Select {user.role} to sign in.")
    return {"access_token": create_access_token(user.id, user.role), "token_type": "bearer", "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "is_active": user.is_active}}

@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "is_active": user.is_active}

@app.get("/api/employees", response_model=list[schemas.EmployeeOut])
def list_employees(search: str = "", department: str = "", status: str = "", db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Employee)
    if user.role == "EMPLOYEE":
        q = q.filter(models.Employee.user_id == user.id)
    if search:
        q = q.filter(models.Employee.full_name.ilike(f"%{search}%"))
    if department:
        q = q.filter(models.Employee.department.ilike(f"%{department}%"))
    if status:
        q = q.filter(models.Employee.status == status.upper())
    return q.order_by(models.Employee.id.desc()).all()

@app.post("/api/employees", response_model=schemas.EmployeeOut, status_code=201)
def create_employee(data: schemas.EmployeeIn, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    if not db.query(models.User).filter(models.User.id == data.user_id).first():
        raise HTTPException(404, "User not found")
    if db.query(models.Employee).filter(models.Employee.user_id == data.user_id).first():
        raise HTTPException(409, "Employee profile already exists for this user")
    item = models.Employee(**data.model_dump()); db.add(item); db.flush()
    for policy in db.query(models.LeavePolicy).all():
        db.add(models.LeaveBalance(employee_id=item.id, leave_type=policy.leave_type, remaining_days=policy.total_days_allowed))
    db.commit(); db.refresh(item); return item

@app.patch("/api/employees/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(employee_id: int, data: schemas.EmployeeUpdate, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    item = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not item: raise HTTPException(404, "Employee not found")
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return item

@app.get("/api/attendance")
def attendance_history(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Attendance)
    if user.role == "EMPLOYEE": q = q.filter(models.Attendance.employee_id == my_employee(db, user).id)
    return [{"id": a.id, "employee_id": a.employee_id, "check_in": a.check_in, "check_out": a.check_out, "date": a.date, "status": a.status, "working_hours": round((a.check_out-a.check_in).total_seconds()/3600, 2) if a.check_in and a.check_out else None} for a in q.order_by(models.Attendance.date.desc()).limit(200).all()]

@app.post("/api/attendance/check-in")
def check_in(db: Session = Depends(get_db), user=Depends(get_current_user)):
    employee = my_employee(db, user); today = date.today()
    row = db.query(models.Attendance).filter_by(employee_id=employee.id, date=today).first()
    if row: raise HTTPException(409, "Attendance already started for today")
    now = datetime.now()
    assignment = db.query(models.EmployeeShift).filter_by(employee_id=employee.id).first()
    shift = db.query(models.Shift).filter_by(id=assignment.shift_id).first() if assignment else None
    start_at = datetime.combine(today, time.fromisoformat(shift.start_time)) if shift else datetime.combine(today, time(9, 30))
    # Ten-minute grace period; shifts use server-local time, consistent with existing attendance timestamps.
    late = now > start_at + __import__("datetime").timedelta(minutes=10)
    row = models.Attendance(employee_id=employee.id, date=today, check_in=now, status="LATE" if late else "PRESENT")
    db.add(row)
    if late:
        notify(db, user.id, "Late attendance recorded", f"Your check-in at {now.strftime('%H:%M')} was after the scheduled start time.")
    db.commit(); db.refresh(row)
    return {"message": "Check-in recorded", "attendance_id": row.id, "check_in": row.check_in, "status": row.status, "shift": shift.name if shift else None}

@app.post("/api/attendance/check-out")
def check_out(db: Session = Depends(get_db), user=Depends(get_current_user)):
    employee = my_employee(db, user)
    assignment = db.query(models.EmployeeShift).filter_by(employee_id=employee.id).first()
    shift = db.query(models.Shift).filter_by(id=assignment.shift_id).first() if assignment else None
    today = date.today()
    row = db.query(models.Attendance).filter_by(employee_id=employee.id, date=today).first()
    # Overnight shifts check out on the calendar day after their check-in.
    if (not row or not row.check_in) and shift and time.fromisoformat(shift.end_time) < time.fromisoformat(shift.start_time):
        row = db.query(models.Attendance).filter_by(employee_id=employee.id, date=today - __import__("datetime").timedelta(days=1)).first()
    if not row or not row.check_in: raise HTTPException(400, "Check in first")
    if row.check_out: raise HTTPException(409, "Already checked out")
    now = datetime.now()
    if now < row.check_in: raise HTTPException(400, "Checkout cannot be before check-in")
    row.check_out = now
    hours = (now-row.check_in).total_seconds()/3600
    end_at = datetime.combine(row.date, time.fromisoformat(shift.end_time)) if shift else datetime.combine(row.date, time(17, 0))
    if shift and time.fromisoformat(shift.end_time) < time.fromisoformat(shift.start_time):
        end_at += __import__("datetime").timedelta(days=1)
    early = now < end_at - __import__("datetime").timedelta(minutes=10)
    was_late = row.status == "LATE"
    if early:
        row.status = "EARLY_LEAVE"
        notify(db, user.id, "Early check-out detected", "Your check-out was earlier than the scheduled shift end.")
    elif hours < 4:
        row.status = "HALF_DAY"
    elif was_late:
        row.status = "LATE"
    else:
        row.status = "PRESENT"
    db.commit()
    return {"message": "Check-out recorded", "working_hours": round(hours, 2), "status": row.status, "early_check_out": early}

@app.get("/api/leaves")
def list_leaves(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Leave)
    if user.role == "EMPLOYEE": q = q.filter(models.Leave.employee_id == my_employee(db, user).id)
    return q.order_by(models.Leave.created_at.desc()).all()

@app.post("/api/leaves", status_code=201)
def apply_leave(data: schemas.LeaveIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    employee = my_employee(db, user)
    if data.start_date < date.today():
        raise HTTPException(400, "Leave cannot be applied for a past date")
    conflict = db.query(models.Leave).filter(
        models.Leave.employee_id == employee.id,
        models.Leave.status.in_(["PENDING", "APPROVED"]),
        models.Leave.start_date <= data.end_date,
        models.Leave.end_date >= data.start_date,
    ).first()
    if conflict:
        raise HTTPException(409, f"These dates overlap with existing {conflict.status.lower()} leave request #{conflict.id}")
    days = sum(1 for offset in range((data.end_date - data.start_date).days + 1)
               if (data.start_date + __import__("datetime").timedelta(days=offset)).weekday() < 5)
    balance = db.query(models.LeaveBalance).filter_by(employee_id=employee.id, leave_type=data.leave_type).first()
    if balance and days > balance.remaining_days:
        raise HTTPException(400, f"Insufficient {data.leave_type.lower()} leave balance. Remaining: {balance.remaining_days} working days")
    item = models.Leave(employee_id=employee.id, **data.model_dump(), status="PENDING")
    db.add(item); db.flush()
    notify(db, user.id, "Leave request submitted", f"Your leave request #{item.id} is pending review.")
    db.commit(); db.refresh(item); return item

@app.patch("/api/leaves/{leave_id}/decision")
def decide_leave(leave_id: int, data: schemas.LeaveDecision, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    item = db.query(models.Leave).filter(models.Leave.id == leave_id).first()
    if not item: raise HTTPException(404, "Leave request not found")
    if item.status != "PENDING": raise HTTPException(409, "Only pending requests can be decided")
    if data.status == "APPROVED":
        days = sum(1 for offset in range((item.end_date - item.start_date).days + 1)
                   if (item.start_date + __import__("datetime").timedelta(days=offset)).weekday() < 5)
        balance = db.query(models.LeaveBalance).filter_by(employee_id=item.employee_id, leave_type=item.leave_type).first()
        if balance:
            if days > balance.remaining_days:
                raise HTTPException(400, f"Insufficient leave balance. Remaining: {balance.remaining_days} working days")
            balance.remaining_days -= days
    item.status = data.status
    employee = db.query(models.Employee).filter(models.Employee.id == item.employee_id).first()
    notify(db, employee.user_id, f"Leave {data.status.lower()}", f"Your leave request #{item.id} was {data.status.lower()}.")
    db.commit(); db.refresh(item); return item

@app.get("/api/payroll")
def list_payroll(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Payroll)
    if user.role == "EMPLOYEE": q = q.filter(models.Payroll.employee_id == my_employee(db, user).id)
    return q.order_by(models.Payroll.month.desc()).all()

@app.post("/api/payroll", status_code=201)
def generate_payroll(data: schemas.PayrollIn, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    employee = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not employee: raise HTTPException(404, "Employee not found")
    if db.query(models.Payroll).filter_by(employee_id=data.employee_id, month=data.month).first():
        raise HTTPException(409, "Payroll already exists for this employee and month")
    net = data.basic_salary + data.allowances + data.bonus - data.deductions
    if net < 0: raise HTTPException(400, "Deductions cannot exceed salary, allowances and bonus")
    item = models.Payroll(**data.model_dump(), net_salary=round(net, 2))
    db.add(item); db.flush()
    notify(db, employee.user_id, "Payroll generated", f"Payroll for {data.month} is available.")
    db.commit(); db.refresh(item); return item


@app.get("/api/payroll/{payroll_id}/payslip")
def download_payslip(
    payroll_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    payroll = (
        db.query(models.Payroll)
        .filter(models.Payroll.id == payroll_id)
        .first()
    )

    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")

    employee = (
        db.query(models.Employee)
        .filter(models.Employee.id == payroll.employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if user.role == "EMPLOYEE":
        current_employee = my_employee(db, user)
        if current_employee.id != payroll.employee_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role not in ("HR", "ADMIN"):
        raise HTTPException(status_code=403, detail="Access denied")

    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()

    content = [
        Paragraph("WorkSphere", styles["Title"]),
        Paragraph("Employee Salary Payslip", styles["Heading2"]),
        Spacer(1, 20),
        Paragraph(f"Employee: {employee.full_name}", styles["Normal"]),
        Paragraph(f"Employee ID: {employee.id}", styles["Normal"]),
        Paragraph(f"Department: {employee.department or 'N/A'}", styles["Normal"]),
        Paragraph(f"Designation: {employee.designation or 'N/A'}", styles["Normal"]),
        Paragraph(f"Salary Month: {payroll.month}", styles["Normal"]),
        Spacer(1, 20),
    ]

    salary_data = [
        ["Salary Component", "Amount (INR)"],
        ["Basic Salary", f"Rs. {payroll.basic_salary:,.2f}"],
        ["Allowances", f"Rs. {(payroll.allowances or 0):,.2f}"],
        ["Bonus", f"Rs. {(payroll.bonus or 0):,.2f}"],
        ["Deductions", f"Rs. {(payroll.deductions or 0):,.2f}"],
        ["Net Salary", f"Rs. {payroll.net_salary:,.2f}"],
    ]

    salary_table = Table(salary_data, colWidths=[250, 150])
    salary_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#243B64")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ])
    )

    content.append(salary_table)
    content.append(Spacer(1, 20))
    content.append(
        Paragraph("Generated by WorkSphere HRMS", styles["Italic"])
    )

    document.build(content)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f'attachment; filename="payslip_{payroll.id}_{payroll.month}.pdf"'
        },
    )


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    today = date.today()
    return {
        "total_employees": db.query(models.Employee).count(),
        "active_employees": db.query(models.Employee).filter_by(status="ACTIVE").count(),
        "present_today": db.query(models.Attendance).filter_by(date=today, status="PRESENT").count(),
        "pending_leaves": db.query(models.Leave).filter_by(status="PENDING").count(),
        "approved_leaves": db.query(models.Leave).filter_by(status="APPROVED").count(),
        "payroll_this_month": round(db.query(func.coalesce(func.sum(models.Payroll.net_salary), 0)).filter_by(month=today.strftime("%Y-%m")).scalar(), 2),
    }

@app.get("/api/leave-balances")
def get_leave_balances(db: Session = Depends(get_db), user=Depends(get_current_user)):
    employee = my_employee(db, user)
    policies = db.query(models.LeavePolicy).order_by(models.LeavePolicy.leave_type).all()
    balances = {b.leave_type: b.remaining_days for b in db.query(models.LeaveBalance).filter_by(employee_id=employee.id).all()}
    return [{"leave_type": p.leave_type, "total_days_allowed": p.total_days_allowed,
             "remaining_days": balances.get(p.leave_type, p.total_days_allowed)} for p in policies]

@app.get("/api/leave-policies")
def list_leave_policies(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.LeavePolicy).order_by(models.LeavePolicy.leave_type).all()

@app.put("/api/leave-policies")
def upsert_leave_policy(data: schemas.LeavePolicyIn, db: Session = Depends(get_db), user=Depends(require_roles("ADMIN"))):
    policy = db.query(models.LeavePolicy).filter_by(leave_type=data.leave_type).first()
    if not policy:
        policy = models.LeavePolicy(**data.model_dump()); db.add(policy)
    else:
        policy.total_days_allowed = data.total_days_allowed
    db.flush()
    for employee in db.query(models.Employee).all():
        balance = db.query(models.LeaveBalance).filter_by(employee_id=employee.id, leave_type=data.leave_type).first()
        if not balance:
            db.add(models.LeaveBalance(employee_id=employee.id, leave_type=data.leave_type, remaining_days=data.total_days_allowed))
        elif balance.remaining_days > data.total_days_allowed:
            balance.remaining_days = data.total_days_allowed
    db.commit(); db.refresh(policy); return policy

@app.post("/api/attendance/mark-absent")
def mark_absent(db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    today = date.today(); created = 0
    for employee in db.query(models.Employee).filter_by(status="ACTIVE").all():
        row = db.query(models.Attendance).filter_by(employee_id=employee.id, date=today).first()
        if not row:
            db.add(models.Attendance(employee_id=employee.id, date=today, status="ABSENT")); created += 1
    db.commit()
    return {"message": "Absent marking completed", "date": str(today), "new_absent_records": created}

@app.get("/api/admin/users")
def admin_list_users(db: Session = Depends(get_db), user=Depends(require_roles("ADMIN"))):
    users = db.query(models.User).order_by(models.User.id.desc()).all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active,
             "employee_id": u.employee.id if u.employee else None, "full_name": u.employee.full_name if u.employee else ""} for u in users]

@app.post("/api/admin/users", status_code=201)
def admin_create_user(data: schemas.AdminUserCreate, db: Session = Depends(get_db), user=Depends(require_roles("ADMIN"))):
    if db.query(models.User).filter((models.User.username == data.username) | (models.User.email == data.email)).first():
        raise HTTPException(409, "Username or email already exists")
    target = models.User(username=data.username, email=data.email, hashed_password=hash_password(data.password), role=data.role)
    db.add(target); db.flush()
    employee = models.Employee(user_id=target.id, full_name=data.full_name, joining_date=date.today())
    db.add(employee); db.flush()
    for policy in db.query(models.LeavePolicy).all():
        db.add(models.LeaveBalance(employee_id=employee.id, leave_type=policy.leave_type, remaining_days=policy.total_days_allowed))
    db.commit(); db.refresh(target)
    return {"id": target.id, "username": target.username, "email": target.email, "role": target.role, "is_active": target.is_active}

@app.patch("/api/admin/users/{user_id}")
def admin_update_user(user_id: int, data: schemas.AdminUserUpdate, db: Session = Depends(get_db), user=Depends(require_roles("ADMIN"))):
    target = db.query(models.User).filter_by(id=user_id).first()
    if not target: raise HTTPException(404, "User not found")
    fields = data.model_dump(exclude_unset=True)
    if target.id == user.id and (fields.get("role", target.role) != target.role or fields.get("is_active", target.is_active) is False):
        raise HTTPException(400, "You cannot change your own role or deactivate your own account")

    # Avoid an accidental lockout by preserving at least one active administrator.
    removes_admin_access = (
        target.role == "ADMIN"
        and target.is_active
        and (fields.get("role", target.role) != "ADMIN" or fields.get("is_active", target.is_active) is False)
    )
    if removes_admin_access and active_admin_count(db) <= 1:
        raise HTTPException(409, "The last active administrator cannot be demoted or deactivated")

    if "username" in fields and db.query(models.User).filter(models.User.username == fields["username"], models.User.id != target.id).first():
        raise HTTPException(409, "Username already exists")
    if "email" in fields and db.query(models.User).filter(models.User.email == fields["email"], models.User.id != target.id).first():
        raise HTTPException(409, "Email already exists")

    for key in ("username", "email", "role", "is_active"):
        if key in fields: setattr(target, key, fields.pop(key))
    employee = target.employee
    if employee:
        for key in ("full_name", "designation", "department", "salary"):
            if key in fields: setattr(employee, key, fields[key])
    elif "full_name" in fields:
        employee = models.Employee(user_id=target.id, full_name=fields["full_name"], joining_date=date.today()); db.add(employee)
    db.commit()
    return {"message": "User updated", "id": target.id, "role": target.role, "is_active": target.is_active}

@app.delete("/api/admin/users/{user_id}", status_code=204)
def admin_delete_user(user_id: int, db: Session = Depends(get_db), user=Depends(require_roles("ADMIN"))):
    target = db.query(models.User).filter_by(id=user_id).first()
    if not target: raise HTTPException(404, "User not found")
    if target.id == user.id: raise HTTPException(400, "You cannot delete your own account")
    if target.role == "ADMIN" and target.is_active and active_admin_count(db) <= 1:
        raise HTTPException(409, "The last active administrator cannot be deleted")
    if target.employee:
        employee_id = target.employee.id
        has_history = any((
            db.query(models.Attendance).filter_by(employee_id=employee_id).first(),
            db.query(models.Leave).filter_by(employee_id=employee_id).first(),
            db.query(models.Payroll).filter_by(employee_id=employee_id).first(),
        ))
        if has_history:
            raise HTTPException(409, "This user has HR history. Deactivate the account to preserve records.")
        db.query(models.LeaveBalance).filter_by(employee_id=employee_id).delete(synchronize_session=False)
        db.delete(target.employee)
    db.query(models.Notification).filter_by(user_id=target.id).delete(synchronize_session=False)
    db.delete(target); db.commit(); return

@app.get("/api/notifications")
def notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    items = db.query(models.Notification).filter_by(user_id=user.id).order_by(models.Notification.created_at.desc()).limit(100).all()
    return {"unread_count": sum(not n.is_read for n in items), "items": items}

@app.patch("/api/notifications/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.Notification).filter_by(id=notification_id, user_id=user.id).first()
    if not item: raise HTTPException(404, "Notification not found")
    item.is_read = True; db.commit(); return {"message": "Notification marked as read"}

@app.post("/api/admin/users/{user_id}/role")
def set_user_role(user_id: int, role: str = Query(..., pattern="^(EMPLOYEE|HR|ADMIN)$"), db: Session = Depends(get_db), user=Depends(require_roles("ADMIN"))):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target: raise HTTPException(404, "User not found")
    if target.role == "ADMIN" and target.is_active and role != "ADMIN" and active_admin_count(db) <= 1:
        raise HTTPException(409, "The last active administrator cannot be demoted")
    target.role = role; db.commit()
    return {"message": "Role updated", "user_id": user_id, "role": role}
