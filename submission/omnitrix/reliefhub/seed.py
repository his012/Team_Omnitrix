"""Milestone 6 — seed data for ReliefHub.

8 camps across 6 districts (one Full, one Closed), 12 inventory items
(2 Low Stock), 20 needs (3 Critical Gaps), 10 dispatches, 10 donations,
15 volunteers.

Usage: python seed.py   (creates reliefhub.db only when it does not exist)
"""
import sqlite3
import os

DB = os.path.join(os.path.dirname(__file__), "reliefhub.db")


def main(path=DB):
    if os.path.exists(path):
        raise SystemExit("Database already exists; seed never overwrites your data.")
    db = sqlite3.connect(path)
    with open(os.path.join(os.path.dirname(__file__), "schema.sql"), encoding="utf-8") as schema:
        db.executescript(schema.read())

    camps = [
        # name, district, capacity, current_families, status
        ("Al-Karam Relief Camp", "Jamshoro", 200, 150, "Active"),
        ("Makli General Camp", "Thatta", 300, 300, "Full"),        # auto-Full case
        ("Sehwan Base Camp", "Jamshoro", 250, 120, "Active"),
        ("Johi Collection Camp", "Dadu", 150, 60, "Active"),
        ("Khairpur Community Camp", "Khairpur", 180, 90, "Active"),
        ("Sukkur Barrage Camp", "Sukkur", 220, 140, "Active"),
        ("Larkana School Shelter", "Larkana", 120, 45, "Active"),
        ("Dadu Old Relief Site", "Dadu", 100, 0, "Closed"),        # closed camp
    ]
    db.executemany("INSERT INTO camps (name, district, capacity, current_families, status) VALUES (?,?,?,?,?)", camps)

    items = [
        # name, category, unit, stock, reorder_level   (last two are Low Stock)
        ("Wheat Flour", "Food", "kg", 5000, 800),
        ("Rice", "Food", "kg", 3200, 500),
        ("Cooking Oil", "Food", "litre", 950, 200),
        ("Lentils (Daal)", "Food", "kg", 1800, 300),
        ("Mineral Water Bottles", "Water", "bottle", 9000, 1500),
        ("Water Purification Tablets", "Water", "pack", 640, 100),
        ("ORS Sachets", "Medical", "pack", 1500, 250),
        ("Paracetamol", "Medical", "box", 420, 100),
        ("Antibiotics", "Medical", "box", 80, 150),              # LOW STOCK
        ("Bandage Rolls", "Medical", "roll", 2100, 300),
        ("Blankets", "Shelter", "piece", 1100, 200),
        ("Water Tanks (5000L)", "Water", "unit", 6, 10),         # LOW STOCK
    ]
    db.executemany("INSERT INTO inventory (name, category, unit, stock, reorder_level) VALUES (?,?,?,?,?)", items)

    needs = [
        # camp_id, item_id, required, priority, fulfilled  (3 critical gaps: High priority < 40%)
        (1, 1, 2000, "High", 1500),   # 75%
        (1, 5, 3000, "Medium", 3000), # 100%
        (1, 7, 500, "High", 500),
        (2, 1, 2500, "High", 800),    # CRITICAL GAP 32%
        (2, 4, 800, "Medium", 800),
        (3, 5, 4000, "High", 1200),   # CRITICAL GAP 30%
        (3, 9, 300, "High", 60),      # CRITICAL GAP 20%
        (3, 11, 600, "Medium", 200),  # 33%
        (4, 2, 1000, "Low", 250),
        (4, 6, 200, "Medium", 120),
        (5, 1, 1500, "High", 900),
        (5, 8, 250, "Medium", 250),
        (5, 10, 400, "Low", 100),
        (6, 5, 3500, "High", 2100),
        (6, 3, 600, "Medium", 300),
        (6, 12, 4, "High", 2),        # 50%
        (7, 11, 350, "Low", 175),
        (7, 2, 900, "Medium", 450),
        (1, 10, 600, "Low", 600),
        (4, 7, 300, "High", 300),
    ]
    db.executemany(
        "INSERT INTO needs (camp_id, inventory_item_id, required_quantity, priority, fulfilled_quantity) VALUES (?,?,?,?,?)",
        needs)

    dispatches = [
        # camp_id, need_id, quantity, status
        (1, 1, 400, "Delivered"),
        (1, 1, 350, "In Transit"),
        (1, 2, 1000, "Delivered"),
        (2, 4, 300, "Delivered"),
        (3, 6, 600, "Delivered"),
        (3, 6, 600, "In Transit"),
        (3, 7, 40, "Pending"),
        (5, 11, 500, "Delivered"),
        (6, 14, 900, "Delivered"),
        (6, 15, 200, "Cancelled"),
    ]
    db.executemany("INSERT INTO dispatches (camp_id, need_id, quantity, status) VALUES (?,?,?,?)", dispatches)

    donations = [
        # type, amount_or_quantity, item_id, category, donor
        ("Cash", 250000, None, "Monetary", "Muet Alumni Association"),
        ("Cash", 100000, None, "Monetary", "Local Business Group"),
        ("Cash", 75000, None, "Monetary", "Anonymous Donor"),
        ("Cash", 50000, None, "Monetary", "Student Welfare Fund"),
        ("In-Kind", 1200, 5, "Water", "Bottling Company"),
        ("In-Kind", 500, 1, "Food", "Flour Mills Ltd"),
        ("In-Kind", 300, 11, "Shelter", "Textile Factory"),
        ("In-Kind", 150, 7, "Medical", "Pharma Distributors"),
        ("In-Kind", 200, 3, "Food", "Grocers Union"),
        ("In-Kind", 800, 10, "Medical", "Hospital Supplies Co"),
    ]
    db.executemany("INSERT INTO donations (type, amount_or_quantity, item_id, category, donor_name) VALUES (?,?,?,?,?)", donations)

    vols = []
    skills = ["Medical", "Logistics", "Cooking", "Driving", "Counselling"]
    names = [
        "Ali Raza", "Sana Fatima", "Bilal Ahmed", "Ayesha Khan", "Usman Tariq",
        "Hina Shah", "Faisal Memon", "Rabia Noor", "Kashif Ali", "Mehak Soomro",
        "Imran Qureshi", "Nida Baig", "Salman Khuhro", "Areeba Malik", "Danish Zafar",
    ]
    # 12 assigned (not to the Closed camp #8), 3 unassigned
    assignments = [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, None, None, None, 5, 6]
    for i, name in enumerate(names):
        vols.append((name, skills[i % 5], assignments[i]))
    db.executemany("INSERT INTO volunteers (name, skill, camp_id) VALUES (?,?,?)", vols)

    db.commit()
    db.close()
    print(f"Seeded {path}: 8 camps, 12 items, 20 needs, 10 dispatches, 10 donations, 15 volunteers")


if __name__ == "__main__":
    main()
