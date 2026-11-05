"""Futebol de Sábado | API inicial de produção, v0.1.

O site do GitHub Pages permanece demonstrativo; esta API precisa de servidor
com disco persistente, HTTPS e um serviço SMS real para entrada dos membros.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", "/tmp/futebol-dev"))
DB_PATH = DATA_DIR / "futebol.sqlite3"
BR = ZoneInfo("America/Sao_Paulo")
MASTER_EMAIL = os.getenv("MASTER_EMAIL", "").lower().strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
PUBLIC_BASE_URL = (os.getenv("PUBLIC_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "http://localhost:8000").rstrip("/")
VERIFY_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
AUTO_PIX_ENABLED = False  # Por decisao do grupo, sem cobranca automatica.
COOKIE_MEMBER = "futebol_member_v1"
COOKIE_ADMIN = "futebol_master_v1"

def now() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")

def parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)

def phone_digits(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if digits.startswith("55") and len(digits) == 13:
        digits = digits[2:]
    if len(digits) != 11 or digits[2] != "9":
        raise HTTPException(422, "Informe um celular brasileiro com DDD e nove dígitos.")
    return digits

@contextmanager
def database(write: bool = False):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=20, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA busy_timeout=20000")
    try:
        if write:
            con.execute("BEGIN IMMEDIATE")
        yield con
        if write:
            con.commit()
    except BaseException:
        if write:
            con.rollback()
        raise
    finally:
        con.close()

def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    try:
        con.executescript((BASE / "schema.sql").read_text(encoding="utf-8"))
        con.commit()
    finally:
        con.close()

def audit(con, match_id, registration_id, actor, action, details=None):
    con.execute(
        "INSERT INTO events(match_id,registration_id,actor,action,details,created_at) VALUES(?,?,?,?,?,?)",
        (match_id, registration_id, actor, action, json.dumps(details or {}, ensure_ascii=False), iso(now())),
    )

def origin_check(request: Request):
    if request.method in ("GET", "HEAD"):
        return
    origin = request.headers.get("origin")
    if origin and urlparse(origin).netloc != urlparse(PUBLIC_BASE_URL).netloc:
        raise HTTPException(403, "Origem não autorizada.")

def sign_session(kind: str, value: str, ttl: int) -> str:
    if not SESSION_SECRET:
        raise HTTPException(503, "Autenticação ainda não configurada.")
    payload = json.dumps({"k": kind, "v": value, "exp": int(time.time()) + ttl}, separators=(",", ":"))
    coded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    sig = hmac.new(SESSION_SECRET.encode(), coded.encode(), hashlib.sha256).hexdigest()
    return coded + "." + sig

def read_session(token: str, kind: str) -> str:
    try:
        coded, sig = token.rsplit(".", 1)
        expected = hmac.new(SESSION_SECRET.encode(), coded.encode(), hashlib.sha256).hexdigest()
        if not SESSION_SECRET or not hmac.compare_digest(sig, expected):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(coded + "=" * (-len(coded) % 4)))
        if data.get("k") != kind or data.get("exp", 0) < time.time():
            raise ValueError()
        return str(data["v"])
    except (ValueError, KeyError, TypeError, IndexError):
        raise HTTPException(401, "Entre novamente para continuar.")

def admin(request: Request):
    origin_check(request)
    read_session(request.cookies.get(COOKIE_ADMIN, ""), "admin")

def current_member(request: Request, con):
    origin_check(request)
    member_id = read_session(request.cookies.get(COOKIE_MEMBER, ""), "member")
    result = con.execute("SELECT * FROM members WHERE id=? AND status='active'", (int(member_id),)).fetchone()
    if not result:
        raise HTTPException(401, "Membro não localizado ou bloqueado.")
    return result

def update_queue(con, match_id: int):
    match = con.execute("SELECT * FROM matches WHERE id=?", (match_id,)).fetchone()
    if not match or match["state"] != "active":
        return
    clock = now()
    at = iso(clock)
    expired = con.execute(
        "SELECT id FROM registrations WHERE match_id=? AND state='reserved' AND reserved_until<=?",
        (match_id, at),
    ).fetchall()
    for row in expired:
        con.execute("UPDATE registrations SET state='expired',updated_at=? WHERE id=?", (at, row["id"]))
        audit(con, match_id, row["id"], "system", "payment_expired")
    if clock < parse(match["queue_release_at"]) or clock >= parse(match["signup_closes_at"]):
        return
    line_count = con.execute(
        "SELECT count(*) FROM registrations WHERE match_id=? AND role='line' AND state IN ('paid','reserved')",
        (match_id,),
    ).fetchone()[0]
    waiting = con.execute(
        "SELECT id FROM registrations WHERE match_id=? AND role='line' AND state='waitlist' ORDER BY queue_entered_at,id",
        (match_id,),
    ).fetchall()
    for candidate in waiting:
        if line_count >= match["line_capacity"]:
            break
        deadline = iso(min(clock + timedelta(minutes=30), parse(match["starts_at"])))
        con.execute(
            "UPDATE registrations SET state='reserved',reserved_until=?,updated_at=? WHERE id=?",
            (deadline, at, candidate["id"]),
        )
        con.execute(
            "INSERT INTO outbox(registration_id,kind,payload,created_at) VALUES(?,?,?,?)",
            (candidate["id"], "promoted", json.dumps({"deadline": deadline}), at),
        )
        audit(con, match_id, candidate["id"], "system", "promoted", {"until": deadline})
        line_count += 1

def tick():
    with database(write=True) as con:
        ids = con.execute("SELECT id FROM matches WHERE state='active'").fetchall()
        for row in ids:
            update_queue(con, row["id"])

async def worker():
    while True:
        try:
            await asyncio.to_thread(tick)
        except Exception as exc:
            print("queue_worker_error:", str(exc)[:150], flush=True)
        await asyncio.sleep(30)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="Futebol de Sábado API", version="0.1.0", lifespan=lifespan)

@app.get("/health")
def health():
    with database() as con:
        con.execute("SELECT 1")
    return {"ok": True, "database": "connected"}

@app.get("/")
def info():
    return {"app": "Futebol de Sábado", "backend": True, "status": "foundation", "docs": "/docs"}

@app.get("/api/config")
def config():
    return {
        "pix_automatico_ativo": False,
        "sms_configurado": bool(TWILIO_SID and TWILIO_TOKEN and VERIFY_SID),
        "master_configurado": bool(ADMIN_PASSWORD and MASTER_EMAIL and SESSION_SECRET),
        "whatsapp": "manual",
    }

def public_match(con, match):
    mid = match["id"]
    query = "SELECT state,role,count(*) AS n FROM registrations WHERE match_id=? GROUP BY state,role"
    groups = {(r["state"], r["role"]): r["n"] for r in con.execute(query, (mid,)).fetchall()}
    paid = groups.get(("paid", "line"), 0)
    reserved = groups.get(("reserved", "line"), 0)
    waiting = groups.get(("waitlist", "line"), 0)
    if now() < parse(match["opens_at"]):
        state = "scheduled"
    elif now() > parse(match["signup_closes_at"]):
        state = "closed"
    elif paid >= match["line_capacity"]:
        state = "fully_paid"
    elif paid + reserved >= match["line_capacity"]:
        state = "waitlist"
    else:
        state = "open"
    return {
        "id": mid, "title": match["title"], "venue": match["venue"], "starts_at": match["starts_at"],
        "opens_at": match["opens_at"], "payment_deadline": match["payment_deadline"],
        "queue_release_at": match["queue_release_at"], "signup_closes_at": match["signup_closes_at"],
        "line_capacity": match["line_capacity"], "goalkeeper_capacity": match["goalkeeper_capacity"],
        "price_cents": match["price_cents"], "paid": paid, "reserved": reserved,
        "waiting": waiting, "status": state,
    }

@app.get("/api/matches")
def matches():
    tick()
    with database() as con:
        rows = con.execute("SELECT * FROM matches WHERE state='active' ORDER BY starts_at DESC LIMIT 30").fetchall()
        return {"matches": [public_match(con, row) for row in rows]}

class MatchIn(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    venue: str = Field(min_length=2, max_length=180)
    starts_at: datetime
    opens_at: datetime
    payment_deadline: datetime
    queue_release_at: datetime
    signup_closes_at: datetime
    line_capacity: int = Field(ge=1, le=10000)
    goalkeeper_capacity: int = Field(default=2, ge=0, le=1000)
    price_cents: int = Field(default=1500, ge=0)

    def validate_dates(self):
        dates = [self.opens_at, self.payment_deadline, self.queue_release_at, self.signup_closes_at, self.starts_at]
        if any(d.tzinfo is None for d in dates):
            raise HTTPException(422, "Informe datas com fuso horário.")
        if not (self.opens_at <= self.payment_deadline <= self.queue_release_at <= self.signup_closes_at <= self.starts_at):
            raise HTTPException(422, "Confira a ordem das datas e horários.")

class AdminLogin(BaseModel):
    email: str
    password: str

LOGIN_TRIES: dict[str, list[float]] = {}

@app.post("/api/admin/login")
def admin_login(payload: AdminLogin, request: Request, response: Response):
    origin_check(request)
    ip = request.client.host if request.client else "unknown"
    times = [t for t in LOGIN_TRIES.get(ip, []) if t > time.time() - 600]
    if len(times) >= 10:
        raise HTTPException(429, "Muitas tentativas. Tente novamente mais tarde.")
    if not (MASTER_EMAIL and ADMIN_PASSWORD and SESSION_SECRET):
        raise HTTPException(503, "Administrador ainda não configurado.")
    verified = hmac.compare_digest(payload.email.lower().strip(), MASTER_EMAIL) and hmac.compare_digest(payload.password, ADMIN_PASSWORD)
    if not verified:
        LOGIN_TRIES[ip] = times + [time.time()]
        raise HTTPException(401, "Credenciais incorretas.")
    LOGIN_TRIES.pop(ip, None)
    response.set_cookie(COOKIE_ADMIN, sign_session("admin", MASTER_EMAIL, 86400), httponly=True, secure=PUBLIC_BASE_URL.startswith("https://"), samesite="strict", max_age=86400)
    return {"ok": True}

@app.post("/api/admin/logout")
def admin_logout(request: Request, response: Response):
    admin(request)
    response.delete_cookie(COOKIE_ADMIN)
    return {"ok": True}

@app.post("/api/admin/matches", status_code=201)
def create_match(payload: MatchIn, request: Request):
    admin(request)
    payload.validate_dates()
    fields = payload.model_dump()
    for key in ("starts_at", "opens_at", "payment_deadline", "queue_release_at", "signup_closes_at"):
        fields[key] = iso(fields[key])
    with database(write=True) as con:
        names = list(fields)
        cursor = con.execute(
            "INSERT INTO matches(" + ",".join(names) + ",created_at) VALUES(" + ",".join("?" for _ in names) + ",?)",
            [fields[k] for k in names] + [iso(now())],
        )
        audit(con, cursor.lastrowid, None, "master", "match_created")
        return {"id": cursor.lastrowid}

@app.put("/api/admin/matches/{match_id}")
def edit_match(match_id: int, payload: MatchIn, request: Request):
    admin(request)
    payload.validate_dates()
    fields = payload.model_dump()
    for key in ("starts_at", "opens_at", "payment_deadline", "queue_release_at", "signup_closes_at"):
        fields[key] = iso(fields[key])
    with database(write=True) as con:
        existing = con.execute("SELECT id FROM matches WHERE id=? AND state='active'", (match_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Partida não encontrada.")
        count = con.execute("SELECT COUNT(*) FROM registrations WHERE match_id=? AND role='line' AND state IN ('paid','reserved')", (match_id,)).fetchone()[0]
        if fields["line_capacity"] < count:
            raise HTTPException(409, "O novo limite é inferior às vagas já ocupadas.")
        con.execute(
            "UPDATE matches SET " + ",".join(k + "=?" for k in fields) + " WHERE id=?",
            [fields[k] for k in fields] + [match_id],
        )
        audit(con, match_id, None, "master", "match_edited")
        return {"ok": True}

@app.delete("/api/admin/matches/{match_id}")
def archive_match(match_id: int, request: Request):
    admin(request)
    with database(write=True) as con:
        cursor = con.execute("UPDATE matches SET state='archived' WHERE id=? AND state='active'", (match_id,))
        if not cursor.rowcount:
            raise HTTPException(404, "Partida não encontrada.")
        audit(con, match_id, None, "master", "match_archived")
    return {"ok": True}

class OtpStart(BaseModel):
    phone: str

class OtpCode(OtpStart):
    code: str = Field(min_length=4, max_length=10)

def twilio_ready():
    return bool(TWILIO_SID and TWILIO_TOKEN and VERIFY_SID and SESSION_SECRET)

@app.post("/api/member/otp/start")
def otp_start(payload: OtpStart, request: Request):
    origin_check(request)
    if not twilio_ready():
        raise HTTPException(503, "Verificação SMS ainda não configurada.")
    phone = phone_digits(payload.phone)
    # Limites iniciais de custo/abuso: 5 SMS por numero e 15 por IP a cada hora.
    # Para producao, complementar com CAPTCHA, Twilio Fraud Guard e observabilidade.
    phone_hash = hashlib.sha256(phone.encode()).hexdigest()
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    cutoff = iso(now() - timedelta(hours=1))
    with database(write=True) as con:
        con.execute("DELETE FROM otp_rate_events WHERE created_at < ?", (iso(now() - timedelta(days=1)),))
        by_phone = con.execute("SELECT COUNT(*) FROM otp_rate_events WHERE phone_hash=? AND created_at>=?", (phone_hash, cutoff)).fetchone()[0]
        by_ip = con.execute("SELECT COUNT(*) FROM otp_rate_events WHERE ip_hash=? AND created_at>=?", (ip_hash, cutoff)).fetchone()[0]
        if by_phone >= 5 or by_ip >= 15:
            raise HTTPException(429, "Limite de verificacoes atingido. Tente mais tarde.")
        con.execute("INSERT INTO otp_rate_events(phone_hash,ip_hash,created_at) VALUES(?,?,?)", (phone_hash, ip_hash, iso(now())))
    url = "https://verify.twilio.com/v2/Services/" + VERIFY_SID + "/Verifications"
    try:
        response = requests.post(url, data={"To": "+55" + phone, "Channel": "sms"}, auth=(TWILIO_SID, TWILIO_TOKEN), timeout=12)
        response.raise_for_status()
    except requests.RequestException:
        raise HTTPException(502, "Não foi possível solicitar o código.")
    return {"ok": True, "message": "Código enviado por SMS."}

@app.post("/api/member/otp/verify")
def otp_verify(payload: OtpCode, request: Request, response: Response):
    origin_check(request)
    if not twilio_ready():
        raise HTTPException(503, "Verificação SMS ainda não configurada.")
    phone = phone_digits(payload.phone)
    url = "https://verify.twilio.com/v2/Services/" + VERIFY_SID + "/VerificationCheck"
    try:
        check = requests.post(url, data={"To": "+55" + phone, "Code": payload.code}, auth=(TWILIO_SID, TWILIO_TOKEN), timeout=12)
        check.raise_for_status()
        valid = check.json().get("status") == "approved"
    except (requests.RequestException, ValueError):
        raise HTTPException(502, "Falha ao verificar o código.")
    if not valid:
        raise HTTPException(401, "Código incorreto ou vencido.")
    with database(write=True) as con:
        con.execute("INSERT OR IGNORE INTO members(phone,phone_verified_at,created_at) VALUES(?,?,?)", (phone, iso(now()), iso(now())))
        member = con.execute("SELECT * FROM members WHERE phone=?", (phone,)).fetchone()
        if member["status"] != "active":
            raise HTTPException(403, "Cadastro bloqueado.")
        response.set_cookie(COOKIE_MEMBER, sign_session("member", str(member["id"]), 7 * 86400), httponly=True, secure=PUBLIC_BASE_URL.startswith("https://"), samesite="strict", max_age=7 * 86400)
        return {"ok": True, "profile_complete": bool(member["name"] and member["email"])}

class Profile(BaseModel):
    name: str = Field(min_length=5, max_length=90)
    email: str = Field(min_length=5, max_length=180)
    whatsapp_opt_in: bool = False

@app.put("/api/member/profile")
def update_profile(payload: Profile, request: Request):
    with database(write=True) as con:
        member = current_member(request, con)
        email = payload.email.lower().strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise HTTPException(422, "Informe um e-mail válido.")
        try:
            con.execute("UPDATE members SET name=?,email=?,whatsapp_opt_in=? WHERE id=?", (payload.name.strip(), email, int(payload.whatsapp_opt_in), member["id"]))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "E-mail já cadastrado para outro membro.")
        return {"ok": True}

@app.get("/api/member/me")
def member_me(request: Request):
    with database() as con:
        m = current_member(request, con)
        return {"id": m["id"], "name": m["name"], "phone": m["phone"], "email": m["email"], "whatsapp_opt_in": bool(m["whatsapp_opt_in"])}

class Signup(BaseModel):
    match_id: int
    position: str | None = Field(default=None, max_length=50)
    goalkeeper: bool = False

@app.post("/api/register", status_code=201)
def register(payload: Signup, request: Request):
    with database(write=True) as con:
        member = current_member(request, con)
        if not member["name"] or not member["email"]:
            raise HTTPException(409, "Complete seu cadastro antes de se inscrever.")
        match = con.execute("SELECT * FROM matches WHERE id=? AND state='active'", (payload.match_id,)).fetchone()
        if not match:
            raise HTTPException(404, "Partida não encontrada.")
        if now() < parse(match["opens_at"]):
            raise HTTPException(403, "Inscrições ainda não abertas.")
        if now() >= parse(match["signup_closes_at"]):
            raise HTTPException(403, "Inscrições encerradas.")
        update_queue(con, match["id"])
        if con.execute("SELECT 1 FROM registrations WHERE match_id=? AND member_id=?", (payload.match_id, member["id"])).fetchone():
            raise HTTPException(409, "Você já possui um registro nesta partida.")
        clock = iso(now())
        role = "goalkeeper" if payload.goalkeeper else "line"
        if payload.goalkeeper:
            count = con.execute("SELECT count(*) FROM registrations WHERE match_id=? AND role='goalkeeper' AND state IN ('confirmed_goalkeeper','goalkeeper_review')", (payload.match_id,)).fetchone()[0]
            state = "goalkeeper_review" if count < match["goalkeeper_capacity"] else "waitlist"
            until = None
        else:
            paid = con.execute("SELECT count(*) FROM registrations WHERE match_id=? AND role='line' AND state='paid'", (payload.match_id,)).fetchone()[0]
            occupied = con.execute("SELECT count(*) FROM registrations WHERE match_id=? AND role='line' AND state IN ('paid','reserved')", (payload.match_id,)).fetchone()[0]
            if paid >= match["line_capacity"]:
                state, until = "interest", None
            elif occupied >= match["line_capacity"]:
                state, until = "waitlist", None
            else:
                state = "reserved"
                limit = parse(match["payment_deadline"]) if now() < parse(match["payment_deadline"]) else now() + timedelta(minutes=30)
                until = iso(min(limit, parse(match["starts_at"])))
        cursor = con.execute(
            "INSERT INTO registrations(match_id,member_id,position,role,state,created_at,updated_at,reserved_until,queue_entered_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (payload.match_id, member["id"], payload.position, role, state, clock, clock, until, clock if state == "waitlist" else None),
        )
        audit(con, payload.match_id, cursor.lastrowid, "member", "registered", {"state": state})
        return {"registration_id": cursor.lastrowid, "state": state, "reserved_until": until}

@app.get("/api/member/registrations")
def my_registrations(request: Request):
    with database() as con:
        member = current_member(request, con)
        rows = con.execute(
            "SELECT r.id,r.match_id,r.role,r.position,r.state,r.reserved_until,r.paid_at,m.title,m.starts_at FROM registrations r JOIN matches m ON m.id=r.match_id WHERE r.member_id=? ORDER BY m.starts_at DESC",
            (member["id"],),
        ).fetchall()
        return {"registrations": [dict(r) for r in rows]}

@app.get("/api/admin/matches/{match_id}/registrations")
def admin_registrations(match_id: int, request: Request):
    admin(request)
    tick()
    with database() as con:
        rows = con.execute(
            "SELECT r.*,mem.name,mem.phone,mem.email FROM registrations r JOIN members mem ON mem.id=r.member_id WHERE r.match_id=? ORDER BY r.created_at,r.id",
            (match_id,),
        ).fetchall()
        return {"registrations": [dict(r) for r in rows]}

class Payment(BaseModel):
    paid_at: datetime | None = None

@app.post("/api/admin/registrations/{registration_id}/confirm-payment")
def confirm_payment(registration_id: int, payload: Payment, request: Request):
    admin(request)
    with database(write=True) as con:
        reg = con.execute("SELECT * FROM registrations WHERE id=?", (registration_id,)).fetchone()
        if not reg or reg["role"] != "line" or reg["state"] != "reserved":
            raise HTTPException(409, "Somente reserva de linha pendente pode ser paga.")
        m = con.execute("SELECT * FROM matches WHERE id=? AND state='active'", (reg["match_id"],)).fetchone()
        if not m:
            raise HTTPException(409, "Partida indisponível.")
        if reg["reserved_until"] and parse(reg["reserved_until"]) < now():
            raise HTTPException(409, "Prazo expirou. Atualize a fila antes de confirmar.")
        paid = payload.paid_at or now()
        if paid.tzinfo is None:
            raise HTTPException(422, "Horário do pagamento requer fuso.")
        con.execute("UPDATE registrations SET state='paid',paid_at=?,reserved_until=NULL,updated_at=? WHERE id=?", (iso(paid), iso(now()), reg["id"]))
        audit(con, reg["match_id"], reg["id"], "master", "payment_confirmed", {"paid_at": iso(paid)})
        return {"ok": True}

@app.post("/api/admin/registrations/{registration_id}/approve-goalkeeper")
def approve_goalkeeper(registration_id: int, request: Request):
    admin(request)
    with database(write=True) as con:
        reg = con.execute("SELECT * FROM registrations WHERE id=? AND role='goalkeeper' AND state='goalkeeper_review'", (registration_id,)).fetchone()
        if not reg:
            raise HTTPException(409, "Não há goleiro pendente para aprovar.")
        con.execute("UPDATE registrations SET state='confirmed_goalkeeper',updated_at=? WHERE id=?", (iso(now()), reg["id"]))
        audit(con, reg["match_id"], reg["id"], "master", "goalkeeper_approved")
        return {"ok": True}

@app.post("/api/admin/matches/{match_id}/process-queue")
def process_queue_manual(match_id: int, request: Request):
    admin(request)
    with database(write=True) as con:
        update_queue(con, match_id)
    return {"ok": True}

@app.get("/api/admin/matches/{match_id}/timeline")
def timeline(match_id: int, request: Request):
    admin(request)
    with database() as con:
        rows = con.execute("SELECT id,registration_id,actor,action,details,created_at FROM events WHERE match_id=? ORDER BY id DESC LIMIT 200", (match_id,)).fetchall()
        return {"events": [dict(x) for x in rows]}

@app.get("/api/matches/{match_id}/classification")
def classification(match_id: int, request: Request):
    with database() as con:
        current_member(request, con)
        m = con.execute("SELECT id FROM matches WHERE id=? AND state='active'", (match_id,)).fetchone()
        if not m:
            raise HTTPException(404, "Partida não encontrada.")
        line = con.execute(
            "SELECT mem.name,r.position,r.paid_at FROM registrations r JOIN members mem ON mem.id=r.member_id WHERE r.match_id=? AND r.role='line' AND r.state='paid' ORDER BY r.paid_at,r.id",
            (match_id,),
        ).fetchall()
        goalkeepers = con.execute(
            "SELECT mem.name FROM registrations r JOIN members mem ON mem.id=r.member_id WHERE r.match_id=? AND r.role='goalkeeper' AND r.state='confirmed_goalkeeper' ORDER BY r.id",
            (match_id,),
        ).fetchall()
        return {
            "first_ten": [{"position": i + 1, **dict(r)} for i, r in enumerate(line[:10])],
            "rotation": [{"position": i + 11, **dict(r)} for i, r in enumerate(line[10:])],
            "goalkeepers": [dict(r) for r in goalkeepers],
        }
