import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BriefcaseBusiness,
  Search,
  Plus,
  LayoutDashboard,
  ClipboardList,
  UserRound,
  ArrowUpRight,
  Clock3,
  MapPin,
  Star,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  Wallet,
  ChevronDown,
  Send,
  SlidersHorizontal,
  Code2,
  Palette,
  BookOpen,
  PenLine,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  MessageSquare,
  CalendarDays,
  Check,
  Menu,
  RefreshCw,
  Sun,
  Moon,
  ArrowRight,
  ArrowLeftRight,
  GraduationCap,
  X,
} from "lucide-react";
import "./style.css";
const CAT = {
  Programming: { icon: Code2, color: "violet" },
  Design: { icon: Palette, color: "pink" },
  Writing: { icon: PenLine, color: "orange" },
  Tutoring: { icon: BookOpen, color: "green" },
};
const request = async (url, method = "GET", body = null, userId = "u1") => {
  const res = await fetch("/api" + url, {
    method,
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw Error(json.error || "Request failed");
  return json;
};
const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
const shortDate = (v) =>
  new Date(v + "T12:00:00").toLocaleDateString("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const money = (v) => (v == null ? "—" : "Rs. " + Number(v).toLocaleString());
const message = (err) => (err instanceof Error ? err.message : String(err));
const emptyGig = {
  title: "",
  description: "",
  type: "Requesting",
  category: "Programming",
  payment_type: "Paid",
  budget: "1500",
  deadline: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
};
function App() {
  const [data, setData] = useState({
    users: [],
    gigs: [],
    applications: [],
    reviews: [],
  });
  const [me, setMe] = useState("u1");
  const [view, setView] = useState("discover");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyGig);
  const [applyMessage, setApplyMessage] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    category: "All",
    type: "All",
    payment: "All",
    status: "Open",
    min: "",
    max: "",
  });
  const [sidebar, setSidebar] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("skillswap-theme") || "light";
    } catch {
      return "light";
    }
  });
  const dialogRef = useRef(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("skillswap-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement,
      oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const targets = () =>
      [
        ...dialog.querySelectorAll(
          'button:not([disabled]),input,textarea,select,[tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length);
    targets()[0]?.focus();
    const keydown = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setError("");
      }
      if (e.key === "Tab") {
        const all = targets(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (!sidebar) return;
    const close = (e) => {
      if (e.key === "Escape") setSidebar(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [sidebar]);
  const load = async () => {
    const [users, gigs, applications, reviews] = await Promise.all(
      ["/users", "/gigs", "/applications", "/reviews"].map((endpoint) =>
        request(endpoint),
      ),
    );
    setData({ users, gigs, applications, reviews });
    setError("");
  };
  useEffect(() => {
    load()
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, []);
  const current = data.users.find((u) => u.id === me) || data.users[0];
  const names = Object.fromEntries(data.users.map((u) => [u.id, u.name]));
  const myGigs = data.gigs.filter((g) => g.user_id === me);
  const myApps = data.applications.filter((a) => a.applicant_id === me);
  const findGig = (id) => data.gigs.find((g) => g.id === id);
  const flash = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 4000);
  };
  const mutate = async (endpoint, method, body, success) => {
    setBusy(true);
    try {
      await request(endpoint, method, body, me);
      await load();
      setModal(null);
      flash(success);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const updateUser = (e) => {
    setMe(e.target.value);
    setModal(null);
    setSelected(null);
    setError("");
  };
  const navigate = (page) => {
    setView(page);
    setSidebar(false);
    setModal(null);
    setError("");
  };
  const openCreate = (gig = null) => {
    setForm(
      gig
        ? {
            title: gig.title,
            description: gig.description,
            type: gig.type,
            category: gig.category,
            payment_type: gig.payment_type,
            budget: gig.budget ?? "",
            deadline: gig.deadline,
          }
        : emptyGig,
    );
    setSelected(gig);
    setModal("gig");
    setError("");
  };
  const openApply = (gig) => {
    setSelected(gig);
    setApplyMessage(
      "Hi! I can help with this gig. I would love to collaborate and discuss the details.",
    );
    setModal("apply");
    setError("");
  };
  const openManage = (gig) => {
    setSelected(gig);
    setModal("manage");
    setError("");
  };
  const openReview = (gig, otherId) => {
    setSelected({ ...gig, reviewee_id: otherId });
    setReviewForm({ rating: 5, comment: "" });
    setModal("review");
    setError("");
  };
  const listed = useMemo(
    () =>
      data.gigs.filter((g) => {
        const f = filters;
        if (
          f.q &&
          !(g.title + " " + g.description)
            .toLowerCase()
            .includes(f.q.toLowerCase())
        )
          return false;
        if (f.category !== "All" && g.category !== f.category) return false;
        if (f.type !== "All" && g.type !== f.type) return false;
        if (f.payment !== "All" && g.payment_type !== f.payment) return false;
        if (f.status !== "All" && g.status !== f.status) return false;
        if (f.min !== "" && (g.budget == null || g.budget < Number(f.min)))
          return false;
        if (f.max !== "" && (g.budget == null || g.budget > Number(f.max)))
          return false;
        return true;
      }),
    [filters, data.gigs],
  );
  const latestMyApplications = [...myApps].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const manageApps = selected
    ? data.applications.filter((a) => a.gig_id === selected.id)
    : [];
  const currentGig = selected ? findGig(selected.id) || selected : null;
  const pendingOnMine = data.applications.filter(
    (a) => myGigs.some((g) => g.id === a.gig_id) && a.status === "Pending",
  ).length;
  const tabs = [
    ["discover", "Explore Gigs", LayoutDashboard],
    ["mine", "My Gigs", BriefcaseBusiness],
    ["applications", "Applications", ClipboardList],
    ["profile", "My Profile", UserRound],
  ];
  const reviewsFor = (id) => data.reviews.filter((r) => r.reviewee_id === id);
  function GigCard({ gig, compact = false }) {
    const category = CAT[gig.category],
      Icon = category.icon;
    const isOwner = gig.user_id === me;
    const applied = myApps.find((a) => a.gig_id === gig.id);
    const available = gig.status === "Open";
    return (
      <article
        className={
          "gig-card " + category.color + " " + (compact ? "compact" : "")
        }
      >
        <div className="gig-top">
          <div className={"category-icon " + category.color}>
            <Icon size={22} />
          </div>
          <div className="gig-badges">
            <span
              className={"status " + gig.status.toLowerCase().replace(" ", "-")}
            >
              {gig.status}
            </span>
            <span className="type-badge">{gig.type}</span>
          </div>
        </div>
        <div className="category-text">
          {gig.category} •{" "}
          {gig.payment_type === "SkillSwap" ? "Skill Swap" : gig.payment_type}
        </div>
        <h3>{gig.title}</h3>
        <p className="gig-desc">{gig.description}</p>
        <div className="gig-meta">
          <span>
            <UserRound size={15} />
            {names[gig.user_id] || "Student"}
          </span>
          <span>
            <CalendarDays size={15} />
            {shortDate(gig.deadline)}
          </span>
        </div>
        <div className="gig-bottom">
          <div>
            <small>
              {gig.payment_type === "Paid" ? "Budget" : "Exchange type"}
            </small>
            <strong>
              {gig.payment_type === "Paid"
                ? money(gig.budget)
                : gig.payment_type === "Free"
                  ? "Volunteer / Free"
                  : "Skill Exchange"}
            </strong>
          </div>
          {isOwner ? (
            <button
              className="btn secondary sm"
              onClick={() => openManage(gig)}
            >
              Manage <ArrowUpRight size={16} />
            </button>
          ) : applied ? (
            <span className="applied">
              <CheckCircle2 size={16} /> {applied.status}
            </span>
          ) : available ? (
            <button className="btn primary sm" onClick={() => openApply(gig)}>
              Apply Now <ArrowUpRight size={16} />
            </button>
          ) : (
            <span className="muted small">Unavailable</span>
          )}
        </div>
      </article>
    );
  }
  const ownCompleted = data.gigs.filter(
    (g) =>
      g.status === "Completed" &&
      (g.user_id === me || g.accepted_applicant_id === me),
  );
  const averageRating = current?.rating;
  const spotlightUsers = data.users.slice(0, 3);
  return (
    <div className="shell">
      <aside className={"sidebar " + (sidebar ? "show" : "")}>
        <div className="brand">
          <span className="brand-mark">
            <ArrowLeftRight size={23} />
          </span>
          <div>
            skill<span>swap</span>
            <small>THE CAMPUS COLLECTIVE</small>
          </div>
        </div>
        <div className="campus-label">
          <GraduationCap size={18} />
          <span>
            MUET, Jamshoro<small>Your campus workspace</small>
          </span>
          <span className="online-dot" />
        </div>
        <div className="menu-title">
          WORKSPACE <span>01 — 04</span>
        </div>
        <nav>
          {tabs.map(([page, label, Icon]) => (
            <button
              key={page}
              onClick={() => navigate(page)}
              aria-current={view === page ? "page" : undefined}
              className={"nav-item " + (view === page ? "active" : "")}
            >
              <Icon size={20} />
              {label}
              {page === "applications" && pendingOnMine > 0 ? (
                <b>{pendingOnMine}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="side-spacer" />
        <div className="side-tip">
          <div className="tip-symbol">
            <ArrowUpRight size={28} />
          </div>
          <strong>Your skills. Real impact.</strong>
          <span>
            That thing you’re good at?
            <br />
            Someone on campus needs it.
          </span>
          <button onClick={() => openCreate()}>
            Share your skills <ArrowRight size={16} />
          </button>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{initials(current?.name)}</div>
          <div>
            <strong>{current?.name || "Student"}</strong>
            <small>Demo profile</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      {sidebar && <div className="shade" onClick={() => setSidebar(false)} />}
      <main className="main">
        <header className="topbar">
          <div className="left-top">
            <button
              aria-label="Toggle navigation"
              aria-expanded={sidebar}
              className="hamburger"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={23} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> {tabs.find((t) => t[0] === view)?.[1]}
            </span>
          </div>
          <div className="top-actions">
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              title={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <span className="live">
              <span /> Demo Mode
            </span>
            <label className="user-select">
              <span>View as</span>
              <select
                aria-label="View as student"
                value={me}
                onChange={updateUser}
              >
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
        </header>
        <div className="page">
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")}>✕</button>
            </div>
          )}
          {toast && (
            <div className="toast" role="status">
              <CheckCircle2 size={18} />
              {toast}
            </div>
          )}
          {loading ? (
            <div className="loading">Loading your campus gigs…</div>
          ) : (
            <>
              {view === "discover" && (
                <>
                  <div className="welcome-row">
                    <div>
                      <p className="eyebrow">
                        YOUR CAMPUS. YOUR POSSIBILITIES.
                      </p>
                      <h2>
                        Hey {current?.name?.split(" ")[0] || "there"}, let’s
                        make things happen<span>.</span>
                      </h2>
                    </div>
                    <span className="campus-pill">
                      <MapPin size={14} /> MUET Campus
                    </span>
                  </div>
                  <section className="hero">
                    <div className="hero-content">
                      <div className="hero-eyebrow">
                        <span /> A LITTLE TALENT GOES A LONG WAY
                      </div>
                      <h1>
                        Big ideas.
                        <br />
                        Meet your <em>people.</em>
                      </h1>
                      <p>
                        Turn what you know into something that matters.
                        <br className="desktop-break" /> Find a gig, swap a
                        skill, build something together.
                      </p>
                      <div className="hero-actions">
                        <button
                          className="btn lime"
                          onClick={() => openCreate()}
                        >
                          Post a gig <ArrowUpRight size={18} />
                        </button>
                        <button
                          className="hero-link"
                          onClick={() =>
                            document
                              .getElementById("opportunities")
                              ?.scrollIntoView({ behavior: "smooth" })
                          }
                        >
                          Find your next thing <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="hero-community">
                        <div className="avatar-group">
                          {spotlightUsers.map((u) => (
                            <span key={u.id}>{initials(u.name)}</span>
                          ))}
                        </div>
                        <span>
                          <strong>{data.users.length} campus creators</strong>
                          <small>Different skills. Shared ambition.</small>
                        </span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="orbit-center">
                        <ArrowLeftRight size={42} />
                        <span>
                          good things
                          <br />
                          happen together.
                        </span>
                      </div>
                      <div className="orbit-tag tag-code">
                        <Code2 size={20} />
                        <span>Code it.</span>
                      </div>
                      <div className="orbit-tag tag-design">
                        <Palette size={20} />
                        <span>Design it.</span>
                      </div>
                      <div className="orbit-tag tag-learn">
                        <BookOpen size={20} />
                        <span>Learn it.</span>
                      </div>
                      <div className="art-star">✳</div>
                      <div className="opportunity-note">
                        <span className="note-dot" />
                        <span>
                          <strong>
                            {
                              data.gigs.filter((g) => g.status === "Open")
                                .length
                            }{" "}
                            opportunities
                          </strong>
                          <small>Your next collaboration is here.</small>
                        </span>
                        <ArrowUpRight size={19} />
                      </div>
                      <span className="art-caption">
                        CONNECT / CREATE / COLLABORATE
                      </span>
                    </div>
                  </section>
                  <section className="stats">
                    <div className="stat">
                      <div className="stat-icon purple">
                        <BriefcaseBusiness size={22} />
                      </div>
                      <div>
                        <strong>{data.gigs.length}</strong>
                        <span>Campus Gigs</span>
                      </div>
                    </div>
                    <div className="stat">
                      <div className="stat-icon turquoise">
                        <Users size={22} />
                      </div>
                      <div>
                        <strong>{data.users.length}</strong>
                        <span>Skilled Students</span>
                      </div>
                    </div>
                    <div className="stat">
                      <div className="stat-icon orange">
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <strong>
                          {
                            data.gigs.filter((g) => g.status === "Completed")
                              .length
                          }
                        </strong>
                        <span>Completed Gigs</span>
                      </div>
                    </div>
                    <div className="stat">
                      <div className="stat-icon pink">
                        <Star size={22} />
                      </div>
                      <div>
                        <strong>{data.reviews.length}</strong>
                        <span>Community Reviews</span>
                      </div>
                    </div>
                  </section>
                  <div className="section-heading" id="opportunities">
                    <div>
                      <div className="eyebrow">FIND YOUR NEXT THING</div>
                      <h2>
                        The opportunity board{" "}
                        <span className="count">{listed.length}</span>
                      </h2>
                      <p>
                        Find your next collaboration, project or skill exchange.
                      </p>
                    </div>
                    <button
                      className="btn primary"
                      onClick={() => openCreate()}
                    >
                      <Plus size={18} /> Post a Gig
                    </button>
                  </div>
                  <div
                    className="category-tabs"
                    role="group"
                    aria-label="Filter by category"
                  >
                    {["All", ...Object.keys(CAT)].map((c) => {
                      const Icon = CAT[c]?.icon || LayoutDashboard;
                      return (
                        <button
                          key={c}
                          aria-pressed={filters.category === c}
                          className={filters.category === c ? "selected" : ""}
                          onClick={() =>
                            setFilters({ ...filters, category: c })
                          }
                        >
                          <Icon size={16} />
                          {c === "All" ? "All opportunities" : c}
                          <span>
                            {
                              data.gigs.filter(
                                (g) => c === "All" || g.category === c,
                              ).length
                            }
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="filterbar">
                    <div className="searchbox">
                      <Search size={19} />
                      <input
                        aria-label="Search gigs"
                        placeholder="Search by title, skill or keyword…"
                        value={filters.q}
                        onChange={(e) =>
                          setFilters({ ...filters, q: e.target.value })
                        }
                      />
                    </div>
                    <div className="filter-controls">
                      <select
                        aria-label="Category"
                        value={filters.category}
                        onChange={(e) =>
                          setFilters({ ...filters, category: e.target.value })
                        }
                      >
                        {["All", ...Object.keys(CAT)].map((x) => (
                          <option key={x} value={x}>
                            {x === "All" ? "All Categories" : x}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Gig type"
                        value={filters.type}
                        onChange={(e) =>
                          setFilters({ ...filters, type: e.target.value })
                        }
                      >
                        {["All", "Offering", "Requesting"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Payment type"
                        value={filters.payment}
                        onChange={(e) =>
                          setFilters({ ...filters, payment: e.target.value })
                        }
                      >
                        {["All", "Paid", "SkillSwap", "Free"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Gig status"
                        value={filters.status}
                        onChange={(e) =>
                          setFilters({ ...filters, status: e.target.value })
                        }
                      >
                        {[
                          "All",
                          "Open",
                          "In Progress",
                          "Completed",
                          "Expired",
                          "Cancelled",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="budgetbar">
                    <Wallet size={15} /> Budget (PKR){" "}
                    <input
                      type="number"
                      min="0"
                      placeholder="Min"
                      aria-label="Minimum budget"
                      value={filters.min}
                      onChange={(e) =>
                        setFilters({ ...filters, min: e.target.value })
                      }
                    />
                    <span>–</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Max"
                      aria-label="Maximum budget"
                      value={filters.max}
                      onChange={(e) =>
                        setFilters({ ...filters, max: e.target.value })
                      }
                    />
                    <button
                      onClick={() =>
                        setFilters({
                          q: "",
                          category: "All",
                          type: "All",
                          payment: "All",
                          status: "Open",
                          min: "",
                          max: "",
                        })
                      }
                    >
                      Reset filters
                    </button>
                  </div>
                  <div className="gig-grid">
                    {listed.map((g) => (
                      <GigCard key={g.id} gig={g} />
                    ))}
                  </div>
                  {!listed.length && (
                    <div className="empty">
                      <Search size={35} />
                      <h3>No matching gigs</h3>
                      <p>
                        A different search could open a new door. Try another
                        keyword or reset your filters.
                      </p>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setFilters({
                            q: "",
                            category: "All",
                            type: "All",
                            payment: "All",
                            status: "Open",
                            min: "",
                            max: "",
                          })
                        }
                      >
                        <RefreshCw size={16} /> Reset filters
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "mine" && (
                <>
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">YOUR WORKSPACE</div>
                      <h2>
                        My Gigs <span className="count">{myGigs.length}</span>
                      </h2>
                      <p>Manage your posts, applicants, and completed work.</p>
                    </div>
                    <button
                      className="btn primary"
                      onClick={() => openCreate()}
                    >
                      <Plus size={18} /> New Gig
                    </button>
                  </div>
                  <div className="info-line">
                    <ShieldCheck size={18} /> Your collaborations start here.
                    Open Manage to review applicants and move your gigs forward.
                  </div>
                  <div className="gig-grid">
                    {myGigs.map((g) => (
                      <GigCard key={g.id} gig={g} />
                    ))}
                  </div>
                  {!myGigs.length && (
                    <div className="empty">
                      <BriefcaseBusiness size={36} />
                      <h3>No gigs posted yet</h3>
                      <p>Create your first gig to find collaborators.</p>
                      <button
                        className="btn primary"
                        onClick={() => openCreate()}
                      >
                        Create gig
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "applications" && (
                <>
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">STAY IN THE LOOP</div>
                      <h2>
                        My Applications{" "}
                        <span className="count">{myApps.length}</span>
                      </h2>
                      <p>
                        Track where you've applied and your application status.
                      </p>
                    </div>
                  </div>
                  <div className="app-list">
                    {latestMyApplications.map((a) => {
                      const gig = findGig(a.gig_id);
                      return (
                        <div className="app-row" key={a.id}>
                          <div
                            className={
                              "category-icon " +
                              (CAT[gig?.category]?.color || "violet")
                            }
                          >
                            {React.createElement(
                              CAT[gig?.category]?.icon || BriefcaseBusiness,
                              { size: 21 },
                            )}
                          </div>
                          <div className="app-info">
                            <h3>{gig?.title || "Gig unavailable"}</h3>
                            <span>
                              {names[gig?.user_id]} • {gig?.category} •{" "}
                              {shortDate(gig?.deadline || "2099-01-01")}
                            </span>
                            <p>“{a.message}”</p>
                          </div>
                          <span className={"status " + a.status.toLowerCase()}>
                            {a.status}
                          </span>
                        </div>
                      );
                    })}
                    {!myApps.length && (
                      <div className="empty">
                        <Send size={35} />
                        <h3>No applications yet</h3>
                        <p>
                          Explore opportunities and send your first application.
                        </p>
                        <button
                          className="btn primary"
                          onClick={() => navigate("discover")}
                        >
                          Explore gigs
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {view === "profile" && current && (
                <>
                  <div className="section-heading">
                    <div>
                      <div className="eyebrow">CAMPUS IDENTITY</div>
                      <h2>My Profile</h2>
                      <p>
                        Skills, achievements, and a reputation built on real
                        collaboration.
                      </p>
                    </div>
                  </div>
                  <section className="profile">
                    <div className="profile-banner">
                      <span>
                        <GraduationCap size={18} /> THE CAMPUS COLLECTIVE
                      </span>
                      <ArrowLeftRight size={100} />
                    </div>
                    <div className="profile-main">
                      <div className="profile-avatar">
                        {initials(current.name)}
                      </div>
                      <h2>{current.name}</h2>
                      <div className="profile-major">
                        {current.major} • Semester {current.semester}
                      </div>
                      <p>{current.bio}</p>
                      <div className="skill-list">
                        {current.skills.map((s) => (
                          <span key={s}>{s}</span>
                        ))}
                      </div>
                      <div className="profile-stats">
                        <div>
                          <strong>{current.posted}</strong>
                          <span>Gigs Posted</span>
                        </div>
                        <div>
                          <strong>{current.completed}</strong>
                          <span>Completed</span>
                        </div>
                        <div>
                          <strong>
                            {current.rating == null
                              ? "New"
                              : current.rating.toFixed(1) + " ★"}
                          </strong>
                          <span>Avg. Rating</span>
                        </div>
                      </div>
                    </div>
                  </section>
                  <div className="section-heading below">
                    <div>
                      <h2>Reputation & Reviews</h2>
                      <p>
                        Good work speaks for itself. Here’s what your
                        collaborators say.
                      </p>
                    </div>
                  </div>
                  <div className="review-grid">
                    {reviewsFor(me).map((r) => (
                      <div className="review-card" key={r.id}>
                        <div>
                          <div className="avatar tiny">
                            {initials(names[r.reviewer_id])}
                          </div>
                          <strong>{names[r.reviewer_id]}</strong>
                        </div>
                        <span className="stars">
                          {"★".repeat(r.rating)}
                          {"☆".repeat(5 - r.rating)}
                        </span>
                        <p>{r.comment}</p>
                      </div>
                    ))}
                    {!reviewsFor(me).length && (
                      <div className="empty">
                        <Star size={35} />
                        <h3>No reviews yet</h3>
                        <p>Complete gigs and collect mutual reviews!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {view === "applications" && ownCompleted.length > 0 && (
            <div className="review-corner">
              {ownCompleted
                .filter(
                  (g) =>
                    g.accepted_applicant_id &&
                    !data.reviews.some(
                      (r) => r.gig_id === g.id && r.reviewer_id === me,
                    ),
                )
                .map((g) => (
                  <button
                    key={g.id}
                    className="btn primary"
                    onClick={() =>
                      openReview(
                        g,
                        g.user_id === me ? g.accepted_applicant_id : g.user_id,
                      )
                    }
                  >
                    Leave review for “{g.title}” <Star size={16} />
                  </button>
                ))}
            </div>
          )}
          <footer>
            <span className="footer-brand">
              <ArrowLeftRight size={16} /> skillswap{" "}
              <span>Made for the way students work.</span>
            </span>
            <span>Team Omnitrix · HacktoberFest 3.0 · Demo data</span>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
              setError("");
            }
          }}
        >
          <div
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">CAMPUS SKILLSWAP</div>
                <h2 id="modal-title">
                  {modal === "gig"
                    ? selected
                      ? "Edit Gig"
                      : "Post a New Gig"
                    : modal === "apply"
                      ? "Apply for this Gig"
                      : modal === "manage"
                        ? "Manage Gig"
                        : "Leave a Review"}
                </h2>
              </div>
              <button
                className="close"
                onClick={() => {
                  setModal(null);
                  setError("");
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {error && (
              <div className="error">
                <AlertCircle size={17} />
                {error}
                <button onClick={() => setError("")}>✕</button>
              </div>
            )}
            {modal === "gig" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(
                    selected ? "/gigs/" + selected.id : "/gigs",
                    selected ? "PATCH" : "POST",
                    {
                      ...form,
                      budget:
                        form.payment_type === "Paid"
                          ? Number(form.budget)
                          : null,
                    },
                    selected ? "Gig updated!" : "Gig published successfully!",
                  );
                }}
              >
                <div className="form-fields">
                  <label>
                    Gig title
                    <input
                      required
                      minLength="4"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder="e.g. Need help with React dashboard"
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      required
                      minLength="12"
                      rows="3"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="What needs to be done?"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Gig type
                      <select
                        value={form.type}
                        onChange={(e) =>
                          setForm({ ...form, type: e.target.value })
                        }
                      >
                        <option>Requesting</option>
                        <option>Offering</option>
                      </select>
                    </label>
                    <label>
                      Category
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm({ ...form, category: e.target.value })
                        }
                      >
                        {Object.keys(CAT).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Payment
                      <select
                        aria-label="Payment"
                        value={form.payment_type}
                        onChange={(e) =>
                          setForm({ ...form, payment_type: e.target.value })
                        }
                      >
                        <option>Paid</option>
                        <option value="SkillSwap">Skill Swap</option>
                        <option>Free</option>
                      </select>
                    </label>
                    {form.payment_type === "Paid" && (
                      <label>
                        Budget (Rs.)
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.budget}
                          onChange={(e) =>
                            setForm({ ...form, budget: e.target.value })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <label>
                    Deadline
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={form.deadline}
                      onChange={(e) =>
                        setForm({ ...form, deadline: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button className="btn primary full" disabled={busy}>
                  {busy ? "Saving…" : selected ? "Save Changes" : "Publish Gig"}{" "}
                  <ArrowUpRight size={17} />
                </button>
              </form>
            )}
            {modal === "apply" && selected && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(
                    "/applications",
                    "POST",
                    { gig_id: selected.id, message: applyMessage },
                    "Application sent successfully!",
                  );
                }}
              >
                <div className="selected-card">
                  <strong>{selected.title}</strong>
                  <span>
                    {selected.category} · {names[selected.user_id]}
                  </span>
                </div>
                <div className="form-fields">
                  <label>
                    Message to gig owner
                    <textarea
                      rows="5"
                      required
                      minLength="5"
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                    />
                  </label>
                </div>
                <button className="btn primary full" disabled={busy}>
                  {busy ? "Sending…" : "Send Application"} <Send size={17} />
                </button>
              </form>
            )}
            {modal === "manage" && currentGig && (
              <div className="manage">
                <div className="selected-card">
                  <strong>{currentGig.title}</strong>
                  <span>
                    {currentGig.category} · {currentGig.status}
                  </span>
                </div>
                <div className="manage-toolbar">
                  {currentGig.status === "Open" && (
                    <>
                      <button
                        className="btn secondary sm"
                        onClick={() => openCreate(currentGig)}
                      >
                        Edit Gig
                      </button>
                      <button
                        className="btn danger sm"
                        disabled={busy}
                        onClick={() => {
                          if (confirm("Cancel this gig?"))
                            mutate(
                              "/gigs/" + currentGig.id,
                              "PATCH",
                              { action: "cancel" },
                              "Gig cancelled.",
                            );
                        }}
                      >
                        Cancel Gig
                      </button>
                    </>
                  )}
                  {currentGig.status === "In Progress" && (
                    <button
                      className="btn primary sm"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Mark this gig as completed?"))
                          mutate(
                            "/gigs/" + currentGig.id,
                            "PATCH",
                            { action: "complete" },
                            "Gig completed! You can now exchange reviews.",
                          );
                      }}
                    >
                      {" "}
                      <CheckCircle2 size={16} /> Mark Completed
                    </button>
                  )}
                </div>
                <h3>
                  Applicants <span className="count">{manageApps.length}</span>
                </h3>
                {manageApps.map((a) => (
                  <div className="applicant" key={a.id}>
                    <div>
                      <strong>{names[a.applicant_id]}</strong>
                      <span className={"status " + a.status.toLowerCase()}>
                        {a.status}
                      </span>
                      <p>{a.message}</p>
                    </div>
                    {currentGig.status === "Open" && a.status === "Pending" && (
                      <div className="applicant-actions">
                        <button
                          className="btn primary sm"
                          disabled={busy}
                          onClick={() =>
                            mutate(
                              "/applications/" + a.id,
                              "PATCH",
                              { action: "accept" },
                              "Applicant accepted; others rejected automatically.",
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          className="btn secondary sm"
                          disabled={busy}
                          onClick={() =>
                            mutate(
                              "/applications/" + a.id,
                              "PATCH",
                              { action: "reject" },
                              "Application rejected.",
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!manageApps.length && (
                  <p className="muted">
                    No applicants yet. Share your gig with the campus!
                  </p>
                )}
                {currentGig.status === "Completed" &&
                  currentGig.accepted_applicant_id &&
                  !data.reviews.some(
                    (r) => r.gig_id === currentGig.id && r.reviewer_id === me,
                  ) && (
                    <button
                      className="btn primary full"
                      onClick={() =>
                        openReview(currentGig, currentGig.accepted_applicant_id)
                      }
                    >
                      Review {names[currentGig.accepted_applicant_id]}{" "}
                      <Star size={16} />
                    </button>
                  )}
              </div>
            )}
            {modal === "review" && selected && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(
                    "/reviews",
                    "POST",
                    {
                      gig_id: selected.id,
                      reviewee_id: selected.reviewee_id,
                      rating: Number(reviewForm.rating),
                      comment: reviewForm.comment,
                    },
                    "Review saved successfully!",
                  );
                }}
              >
                <div className="selected-card">
                  <strong>Review {names[selected.reviewee_id]}</strong>
                  <span>For: {selected.title}</span>
                </div>
                <div className="form-fields">
                  <label>
                    Rating
                    <select
                      aria-label="Rating"
                      value={reviewForm.rating}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          rating: Number(e.target.value),
                        })
                      }
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} out of 5 stars
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Your experience
                    <textarea
                      rows="4"
                      required
                      minLength="3"
                      value={reviewForm.comment}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          comment: e.target.value,
                        })
                      }
                      placeholder="Describe your collaboration…"
                    />
                  </label>
                </div>
                <button className="btn primary full" disabled={busy}>
                  Submit Review <Star size={17} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
