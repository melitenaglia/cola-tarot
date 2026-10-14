"""Prueba SQL aislada: numeración única, idempotencia y tope de turnos."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
import sqlite3
import uuid

UPDATE = """UPDATE events SET current_number=current_number+1,updated_at=CURRENT_TIMESTAMP
 WHERE id=? AND status='published' AND queue_status='open' AND deleted_at IS NULL
 AND (max_turns IS NULL OR current_number<max_turns)
 AND (queue_opens_at IS NULL OR unixepoch(queue_opens_at)<=unixepoch('now'))
 AND (queue_closes_at IS NULL OR unixepoch(queue_closes_at)>unixepoch('now'))
 AND NOT EXISTS(SELECT 1 FROM turns WHERE event_id=? AND device_token=?)
 RETURNING current_number"""
INSERT = """INSERT INTO turns(id,event_id,number,code,device_token,status)
 SELECT ?,e.id,e.current_number,e.event_code||'-T'||printf('%03d',e.current_number),?,'issued'
 FROM events e WHERE e.id=? AND changes()=1 RETURNING number,code"""

with TemporaryDirectory(prefix="sau-d1-concurrency-") as directory:
    path = str(Path(directory) / "test.db")
    db = sqlite3.connect(path)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE events(
          id TEXT PRIMARY KEY, current_number INTEGER NOT NULL DEFAULT 0,
          event_code TEXT NOT NULL, status TEXT NOT NULL, queue_status TEXT NOT NULL,
          deleted_at TEXT, max_turns INTEGER,queue_opens_at TEXT,queue_closes_at TEXT,updated_at TEXT);
        CREATE TABLE turns(
          id TEXT PRIMARY KEY,event_id TEXT,number INTEGER,code TEXT,
          device_token TEXT,status TEXT,UNIQUE(event_id,number),UNIQUE(event_id,device_token));
        INSERT INTO events(id,event_code,status,queue_status,max_turns)
          VALUES('demo','TEST','published','open',15);
    """)
    db.close()

    def issue(token):
        db = sqlite3.connect(path, timeout=30, isolation_level=None)
        try:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute(
                "SELECT number,code FROM turns WHERE event_id=? AND device_token=?",
                ("demo", token),
            ).fetchone()
            if old is None:
                db.execute(UPDATE, ("demo", "demo", token)).fetchall()
                old = db.execute(
                    INSERT, (str(uuid.uuid4()), "demo", token, "demo")
                ).fetchone()
            db.execute("COMMIT")
            return old
        except Exception:
            db.execute("ROLLBACK")
            raise
        finally:
            db.close()

    tokens = [f"device-{i:012d}" for i in range(50)]
    with ThreadPoolExecutor(max_workers=25) as pool:
        results = list(pool.map(issue, tokens))
    issued = [(tokens[i], v) for i, v in enumerate(results) if v is not None]
    assert len(issued) == 15, issued
    assert sorted(v[0] for _, v in issued) == list(range(1, 16)), issued

    same_token, first = issued[0]
    with ThreadPoolExecutor(max_workers=20) as pool:
        repeated = list(pool.map(issue, [same_token] * 30))
    assert all(v == first for v in repeated), repeated

    check = sqlite3.connect(path)
    count, distinct_count, counter = check.execute(
        """SELECT (SELECT COUNT(*) FROM turns),
                  (SELECT COUNT(DISTINCT number) FROM turns),
                  (SELECT current_number FROM events WHERE id='demo')"""
    ).fetchone()
    assert (count, distinct_count, counter) == (15, 15, 15)
    print("OK: 50 peticiones, 15 números únicos, 30 reintentos idempotentes.")
