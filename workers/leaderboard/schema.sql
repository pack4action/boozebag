-- One row per wallet per game: the best that wallet has posted, and when.
-- The board is a single ordered read off this table.
CREATE TABLE IF NOT EXISTS scores (
  game       TEXT NOT NULL,
  address    TEXT NOT NULL,
  name       TEXT,
  score      REAL NOT NULL,
  meta       REAL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (game, address)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores (game, score DESC);

-- What has been written recently, by wallet and by address of origin, so a
-- script cannot sit there posting. Rows older than an hour are swept on
-- write; nothing here is worth keeping.
CREATE TABLE IF NOT EXISTS hits (
  key TEXT PRIMARY KEY,
  at  INTEGER NOT NULL
);

-- Every beer cracked on the front page, a row per day. The Worker makes
-- this table on first use, so an existing database does not have to be
-- touched; it is here so a fresh one starts with it.
CREATE TABLE IF NOT EXISTS cracks (
  day TEXT PRIMARY KEY,
  n   INTEGER NOT NULL
);
