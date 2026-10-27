"""Phase 3 routes: shifts, team calendar, secure documents, performance and analytics."""
from datetime import date, datetime, time, timedelta
from pathlib import Path
from uuid import uuid4
import os

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import get_db
from . import models
from .dependencies import get_current_user, require_roles

router = APIRouter(prefix="/api", tags=["Phase 3 - Smart HR"])
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./secure_uploads")).resolve()
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

class ShiftIn(BaseModel):
    name: str = Field(min_length=2, max_length=30)
    start_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end_time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")

class ShiftAssignIn(BaseModel):
    employee_id: int = Field(gt=0)
    shift_id: int = Field(gt=0)

class ReviewIn(BaseModel):
    employee_id: int = Field(gt=0)
    review_period: str = Field(min_length=2, max_length=100)
    rating: int = Field(ge=1, le=5)
    feedback: str = Field(min_length=3, max_length=5000)

@router.get("/shifts")
def list_shifts(db: Session = Depends(get_db), user=Depends(get_current_user)):
    shifts = db.query(models.Shift).order_by(models.Shift.start_time).all()
    return [{"id": s.id, "name": s.name, "start_time": s.start_time, "end_time": s.end_time} for s in shifts]

@router.post("/shifts", status_code=201)
def create_shift(data: ShiftIn, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    if data.start_time == data.end_time:
        raise HTTPException(422, "Shift start and end times cannot be identical")
    if db.query(models.Shift).filter(func.lower(models.Shift.name) == data.name.lower()).first():
        raise HTTPException(409, "A shift with this name already exists")
    row = models.Shift(name=data.name.strip(), start_time=data.start_time, end_time=data.end_time)
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "name": row.name, "start_time": row.start_time, "end_time": row.end_time}

@router.get("/shifts/assignments")
def shift_assignments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.EmployeeShift, models.Employee, models.Shift).join(models.Employee, models.EmployeeShift.employee_id == models.Employee.id).join(models.Shift, models.EmployeeShift.shift_id == models.Shift.id)
    if user.role == "EMPLOYEE":
        q = q.filter(models.Employee.user_id == user.id)
    return [{"id": a.id, "employee_id": e.id, "full_name": e.full_name, "department": e.department, "shift_id": s.id, "shift_name": s.name, "start_time": s.start_time, "end_time": s.end_time} for a,e,s in q.order_by(models.Employee.full_name).all()]

@router.post("/shifts/assignments", status_code=201)
def assign_shift(data: ShiftAssignIn, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    employee = db.query(models.Employee).filter_by(id=data.employee_id).first()
    shift = db.query(models.Shift).filter_by(id=data.shift_id).first()
    if not employee: raise HTTPException(404, "Employee not found")
    if not shift: raise HTTPException(404, "Shift not found")
    row = db.query(models.EmployeeShift).filter_by(employee_id=employee.id).first()
    if row:
        row.shift_id = shift.id
    else:
        row = models.EmployeeShift(employee_id=employee.id, shift_id=shift.id); db.add(row)
    db.commit(); db.refresh(row)
    user_row = db.query(models.User).filter_by(id=employee.user_id).first()
    if user_row:
        db.add(models.Notification(user_id=user_row.id, title="Shift assigned", message=f"Your shift is {shift.name} ({shift.start_time}–{shift.end_time}).")); db.commit()
    return {"message": "Shift assigned", "employee_id": employee.id, "shift_id": shift.id}

@router.get("/leave-calendar")
def leave_calendar(start: date = Query(default=None), end: date = Query(default=None), department: str = "", db: Session = Depends(get_db), user=Depends(get_current_user)):
    start = start or date.today().replace(day=1)
    end = end or (start + timedelta(days=62))
    if end < start: raise HTTPException(422, "end must be on or after start")
    q = db.query(models.Leave, models.Employee).join(models.Employee, models.Leave.employee_id == models.Employee.id).filter(models.Leave.status == "APPROVED", models.Leave.start_date <= end, models.Leave.end_date >= start)
    if user.role == "EMPLOYEE": q = q.filter(models.Employee.department == (db.query(models.Employee.department).filter_by(user_id=user.id).scalar() or ""))
    if department: q = q.filter(models.Employee.department.ilike(f"%{department}%"))
    return [{"id": l.id, "employee_id": e.id, "employee_name": e.full_name, "department": e.department, "leave_type": l.leave_type, "start_date": l.start_date, "end_date": l.end_date, "status": l.status} for l,e in q.order_by(models.Leave.start_date).all()]

@router.get("/documents")
def list_documents(employee_id: int | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.EmployeeDocument)
    if user.role == "EMPLOYEE":
        own = db.query(models.Employee.id).filter_by(user_id=user.id).scalar()
        if not own: raise HTTPException(404, "Employee profile not found")
        q = q.filter(models.EmployeeDocument.employee_id == own)
    elif employee_id is not None:
        q = q.filter(models.EmployeeDocument.employee_id == employee_id)
    return [{"id": d.id, "employee_id": d.employee_id, "file_name": d.file_name, "uploaded_at": d.uploaded_at, "download_url": f"/api/documents/{d.id}/download"} for d in q.order_by(models.EmployeeDocument.uploaded_at.desc()).all()]

@router.post("/documents", status_code=201)
async def upload_document(employee_id: int = Query(..., gt=0), file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    employee = db.query(models.Employee).filter_by(id=employee_id).first()
    if not employee: raise HTTPException(404, "Employee not found")
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES: raise HTTPException(415, "Only PDF, JPG, PNG, and DOCX files are allowed")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if not raw: raise HTTPException(400, "Uploaded file is empty")
    if len(raw) > MAX_UPLOAD_BYTES: raise HTTPException(413, "Maximum file size is 5 MB")
    # Verify basic file signatures rather than trusting the browser-provided MIME type.
    signatures = {"application/pdf": raw.startswith(b"%PDF-"), "image/jpeg": raw.startswith(b"\xff\xd8\xff"), "image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document": raw.startswith(b"PK\x03\x04")}
    if not signatures.get(content_type, False): raise HTTPException(415, "File contents do not match the selected file type")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid4().hex}{ALLOWED_TYPES[content_type]}"
    path = UPLOAD_DIR / stored
    path.write_bytes(raw)
    safe_name = Path(file.filename or "document").name[:255]
    row = models.EmployeeDocument(employee_id=employee_id, file_name=safe_name, stored_name=stored, content_type=content_type)
    db.add(row); db.flush()
    owner = db.query(models.User).filter_by(id=employee.user_id).first()
    if owner: db.add(models.Notification(user_id=owner.id, title="New document uploaded", message=f"A document ({safe_name}) was added to your employee record."))
    db.commit(); db.refresh(row)
    return {"id": row.id, "employee_id": row.employee_id, "file_name": row.file_name, "uploaded_at": row.uploaded_at}

@router.get("/documents/{document_id}/download")
def download_document(document_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    doc = db.query(models.EmployeeDocument).filter_by(id=document_id).first()
    if not doc: raise HTTPException(404, "Document not found")
    if user.role == "EMPLOYEE":
        own = db.query(models.Employee.id).filter_by(user_id=user.id).scalar()
        if own != doc.employee_id: raise HTTPException(403, "You cannot access another employee's documents")
    path = UPLOAD_DIR / doc.stored_name
    if not path.is_file(): raise HTTPException(404, "Stored file is missing")
    return FileResponse(path, media_type=doc.content_type, filename=doc.file_name, content_disposition_type="attachment", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})

@router.get("/performance")
def list_reviews(employee_id: int | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.PerformanceReview, models.Employee).join(models.Employee, models.PerformanceReview.employee_id == models.Employee.id)
    if user.role == "EMPLOYEE":
        own = db.query(models.Employee.id).filter_by(user_id=user.id).scalar()
        if not own: raise HTTPException(404, "Employee profile not found")
        q = q.filter(models.PerformanceReview.employee_id == own)
    elif employee_id is not None:
        q = q.filter(models.PerformanceReview.employee_id == employee_id)
    return [{"id": r.id, "employee_id": e.id, "employee_name": e.full_name, "department": e.department, "review_period": r.review_period, "rating": r.rating, "feedback": r.feedback, "created_at": r.created_at} for r,e in q.order_by(models.PerformanceReview.created_at.desc()).all()]

@router.post("/performance", status_code=201)
def create_review(data: ReviewIn, db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    employee = db.query(models.Employee).filter_by(id=data.employee_id).first()
    if not employee: raise HTTPException(404, "Employee not found")
    row = models.PerformanceReview(**data.model_dump(), created_by=user.id)
    db.add(row); db.flush()
    owner = db.query(models.User).filter_by(id=employee.user_id).first()
    if owner: db.add(models.Notification(user_id=owner.id, title="Performance review updated", message=f"A performance review for {data.review_period} is available."))
    db.commit(); db.refresh(row)
    return {"id": row.id, "employee_id": row.employee_id, "review_period": row.review_period, "rating": row.rating, "feedback": row.feedback, "created_at": row.created_at}

@router.get("/analytics/advanced")
def advanced_analytics(start: date | None = None, end: date | None = None, department: str = "", db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    start = start or (date.today() - timedelta(days=29)); end = end or date.today()
    if end < start: raise HTTPException(422, "end must be on or after start")
    empq = db.query(models.Employee).filter(models.Employee.status == "ACTIVE")
    if department: empq = empq.filter(models.Employee.department.ilike(f"%{department}%"))
    employee_ids = [e.id for e in empq.all()]
    attendance = db.query(models.Attendance.status, func.count(models.Attendance.id)).filter(models.Attendance.date >= start, models.Attendance.date <= end)
    leaves = db.query(models.Leave.status, func.count(models.Leave.id)).filter(models.Leave.start_date <= end, models.Leave.end_date >= start)
    performance = db.query(func.avg(models.PerformanceReview.rating), func.count(models.PerformanceReview.id))
    if employee_ids:
        attendance = attendance.filter(models.Attendance.employee_id.in_(employee_ids)); leaves = leaves.filter(models.Leave.employee_id.in_(employee_ids)); performance = performance.filter(models.PerformanceReview.employee_id.in_(employee_ids))
    else:
        return {"start": start, "end": end, "attendance": [], "leaves": [], "attendance_trend": [], "leave_trend": [], "departments": [], "performance": {"average_rating": None, "reviews": 0}}
    att_rows = attendance.group_by(models.Attendance.status).all()
    leave_rows = leaves.group_by(models.Leave.status).all()
    attendance_trend = db.query(models.Attendance.date, func.count(models.Attendance.id)).filter(models.Attendance.date >= start, models.Attendance.date <= end, models.Attendance.employee_id.in_(employee_ids)).group_by(models.Attendance.date).order_by(models.Attendance.date).all()
    leave_trend = db.query(models.Leave.start_date, func.count(models.Leave.id)).filter(models.Leave.start_date >= start, models.Leave.start_date <= end, models.Leave.employee_id.in_(employee_ids)).group_by(models.Leave.start_date).order_by(models.Leave.start_date).all()
    dept_rows = db.query(models.Employee.department, func.count(models.Employee.id)).filter(models.Employee.id.in_(employee_ids)).group_by(models.Employee.department).all()
    avg_rating, review_count = performance.one()
    return {"start": start, "end": end, "attendance": [{"status": s, "count": c} for s,c in att_rows], "leaves": [{"status": s, "count": c} for s,c in leave_rows], "attendance_trend": [{"date": d, "count": c} for d,c in attendance_trend], "leave_trend": [{"date": d, "count": c} for d,c in leave_trend], "departments": [{"department": d or "General", "employees": c} for d,c in dept_rows], "performance": {"average_rating": round(float(avg_rating), 2) if avg_rating is not None else None, "reviews": review_count}}

@router.get("/employees/search")
def advanced_employee_search(q: str = "", department: str = "", role: str = "", status: str = "", attendance_status: str = "", performance_rating: int | None = Query(default=None, ge=1, le=5), db: Session = Depends(get_db), user=Depends(require_roles("HR", "ADMIN"))):
    query = db.query(models.Employee, models.User).join(models.User, models.Employee.user_id == models.User.id)
    if q: query = query.filter(models.Employee.full_name.ilike(f"%{q}%"))
    if department: query = query.filter(models.Employee.department.ilike(f"%{department}%"))
    if role: query = query.filter(models.User.role == role.upper())
    if status: query = query.filter(models.Employee.status == status.upper())
    rows = query.order_by(models.Employee.full_name).all()
    result = []
    today = date.today()
    for employee, account in rows:
        att = db.query(models.Attendance).filter_by(employee_id=employee.id, date=today).first()
        if attendance_status and (att.status if att else "NOT_MARKED") != attendance_status.upper(): continue
        if performance_rating is not None:
            avg = db.query(func.avg(models.PerformanceReview.rating)).filter_by(employee_id=employee.id).scalar()
            if avg is None or round(float(avg)) != performance_rating: continue
        result.append({"id": employee.id, "user_id": employee.user_id, "full_name": employee.full_name, "username": account.username, "email": account.email, "role": account.role, "designation": employee.designation, "department": employee.department, "joining_date": employee.joining_date, "salary": employee.salary, "status": employee.status, "attendance_status": att.status if att else "NOT_MARKED"})
    return result
