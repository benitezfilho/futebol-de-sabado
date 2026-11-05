from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
import main as project

@pytest.fixture()
def c(tmp_path, monkeypatch):
    monkeypatch.setattr(project, "DATA_DIR", tmp_path)
    monkeypatch.setattr(project, "DB_PATH", tmp_path / "test.sqlite3")
    monkeypatch.setattr(project, "MASTER_EMAIL", "master@example.com")
    monkeypatch.setattr(project, "ADMIN_PASSWORD", "strong-password-not-demo")
    monkeypatch.setattr(project, "SESSION_SECRET", "test-signing-secret-32-bytes-long")
    monkeypatch.setattr(project, "PUBLIC_BASE_URL", "http://testserver")
    monkeypatch.setattr(project, "TWILIO_SID", "")
    monkeypatch.setattr(project, "TWILIO_TOKEN", "")
    monkeypatch.setattr(project, "VERIFY_SID", "")
    with TestClient(project.app) as client:
        yield client

def match_data(*, opens_offset=-1, cutoff_offset=1, release_offset=1, capacity=2):
    dt = project.now()
    return {
        "title": "Futebol de Sabado",
        "venue": "Farofa Society",
        "opens_at": (dt + timedelta(hours=opens_offset)).isoformat(),
        "payment_deadline": (dt + timedelta(hours=cutoff_offset)).isoformat(),
        "queue_release_at": (dt + timedelta(hours=release_offset)).isoformat(),
        "signup_closes_at": (dt + timedelta(hours=5)).isoformat(),
        "starts_at": (dt + timedelta(hours=6)).isoformat(),
        "line_capacity": capacity,
        "goalkeeper_capacity": 2,
        "price_cents": 1500,
    }

def login_master(c):
    resp = c.post("/api/admin/login", json={"email": "master@example.com", "password": "strong-password-not-demo"})
    assert resp.status_code == 200, resp.text

def member_session(c, i=1):
    phone = f"6299900{i:04d}"
    with project.database(write=True) as db:
        db.execute(
            "INSERT INTO members(name,email,phone,phone_verified_at,created_at) VALUES(?,?,?,?,?)",
            (f"Jogador Exemplo {i}", f"j{i}@example.com", phone, project.iso(project.now()), project.iso(project.now())),
        )
        uid = db.execute("SELECT id FROM members WHERE phone=?", (phone,)).fetchone()[0]
    c.cookies.set(project.COOKIE_MEMBER, project.sign_session("member", str(uid), 3600))
    return uid

def test_health_and_admin_isolation(c):
    assert c.get("/health").json()["database"] == "connected"
    assert c.get("/api/admin/matches/1/registrations").status_code == 401
    assert c.post("/api/admin/login", json={"email": "master@example.com", "password": "demo123"}).status_code == 401
    assert c.post("/api/register", json={"match_id": 1}).status_code == 401

def test_match_creation_and_signup_block_before_opening(c):
    login_master(c)
    data = match_data(opens_offset=2, cutoff_offset=3, release_offset=3)
    resp = c.post("/api/admin/matches", json=data)
    assert resp.status_code == 201, resp.text
    mid = resp.json()["id"]
    member_session(c)
    signup = c.post("/api/register", json={"match_id": mid, "position": "meia"})
    assert signup.status_code == 403
    assert "ainda não abertas" in signup.json()["detail"]
    assert c.get("/api/matches").json()["matches"][0]["status"] == "scheduled"

def test_signup_unique_goalkeeper_and_interest_only_after_paid_capacity(c):
    login_master(c)
    mid = c.post("/api/admin/matches", json=match_data(capacity=1)).json()["id"]
    member_session(c, 1)
    first = c.post("/api/register", json={"match_id": mid, "position": "atacante"})
    assert first.status_code == 201 and first.json()["state"] == "reserved"
    assert c.post("/api/register", json={"match_id": mid}).status_code == 409
    # Master confere pagamento manualmente.
    paid = c.post(f"/api/admin/registrations/{first.json()['registration_id']}/confirm-payment", json={})
    assert paid.status_code == 200, paid.text
    member_session(c, 2)
    interest = c.post("/api/register", json={"match_id": mid, "position": "lateral"})
    assert interest.status_code == 201 and interest.json()["state"] == "interest"
    member_session(c, 3)
    goalie = c.post("/api/register", json={"match_id": mid, "goalkeeper": True})
    assert goalie.status_code == 201 and goalie.json()["state"] == "goalkeeper_review"

def test_queue_promotes_fifo_after_expiration(c):
    login_master(c)
    data = match_data(cutoff_offset=-1, release_offset=-1, capacity=1)
    # Agora o calendário já venceu, apenas para validar o processamento da fila.
    # O endpoint de criação exige abertura <= vencimento <= liberação <= encerramento.
    mid = c.post("/api/admin/matches", json=data).json()["id"]
    with project.database(write=True) as db:
        clock = project.iso(project.now())
        expired = project.iso(project.now() - timedelta(minutes=2))
        for i, state in ((1, "reserved"), (2, "waitlist"), (3, "waitlist")):
            db.execute("INSERT INTO members(name,email,phone,phone_verified_at,created_at) VALUES(?,?,?,?,?)",
                (f"Jogador {i}", f"q{i}@example.com", f"6299901{i:04d}", clock, clock))
            uid = db.execute("SELECT id FROM members WHERE email=?", (f"q{i}@example.com",)).fetchone()[0]
            db.execute("INSERT INTO registrations(match_id,member_id,role,state,created_at,updated_at,reserved_until,queue_entered_at) VALUES(?,?,?,?,?,?,?,?)",
                (mid, uid, "line", state, clock, clock, expired if i == 1 else None, project.iso(project.now() + timedelta(seconds=i)) if i > 1 else None))
    r = c.post(f"/api/admin/matches/{mid}/process-queue")
    assert r.status_code == 200
    with project.database() as db:
        states = [x["state"] for x in db.execute("SELECT state FROM registrations WHERE match_id=? ORDER BY id", (mid,))]
    assert states == ["expired", "reserved", "waitlist"]
