PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS camps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    current_families INTEGER NOT NULL DEFAULT 0 CHECK (current_families >= 0),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Full', 'Closed'))
);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0)
);

CREATE TABLE IF NOT EXISTS needs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camp_id INTEGER NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
    inventory_item_id INTEGER NOT NULL REFERENCES inventory(id),
    required_quantity INTEGER NOT NULL CHECK (required_quantity > 0),
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    fulfilled_quantity INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_quantity >= 0)
);

CREATE TABLE IF NOT EXISTS dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camp_id INTEGER NOT NULL REFERENCES camps(id),
    need_id INTEGER NOT NULL REFERENCES needs(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'In Transit', 'Delivered', 'Cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('Cash', 'In-Kind')),
    amount_or_quantity REAL NOT NULL CHECK (amount_or_quantity > 0),
    item_id INTEGER REFERENCES inventory(id),
    category TEXT NOT NULL,
    donor_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    skill TEXT NOT NULL CHECK (skill IN ('Medical', 'Logistics', 'Cooking', 'Driving', 'Counselling')),
    camp_id INTEGER REFERENCES camps(id)
);
