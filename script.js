/* ============================================================
   Mobile Payment Reminder System for Schools
   Vanilla JS single-page app. All data lives in localStorage
   so the demo behaves like a real, persistent system without
   a backend.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "sprs_fee_register_v1";

  var PARENT_TABS = [
    { id: "dashboard", label: "Schedules & Due Dates" },
    { id: "reminders", label: "Reminders" },
    { id: "pay", label: "Make a Payment" },
    { id: "history", label: "History & Receipts" }
  ];

  var ADMIN_TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "students", label: "Students & Records" },
    { id: "schedules", label: "Schedules & Deadlines" },
    { id: "monitor", label: "Monitor & Reminders" },
    { id: "reports", label: "Reports & Analytics" }
  ];

  /* ---------------- persistence ---------------- */

  var DB = loadData();
  var ui = { screen: "cover", tab: null, modal: null, loginError: "" };

  if (DB.session) {
    ui.screen = "app";
    ui.tab = DB.session.role === "admin" ? "dashboard" : "dashboard";
  }

  function loadData() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* fall through to seed */ }
    }
    return seed();
  }

  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); } catch (e) { /* storage unavailable */ }
  }

  function addDays(base, n) {
    var d = new Date(base);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function seed() {
    var today = new Date();
    var students = [
      { id: "STU-1001", name: "Amara Okafor", className: "JSS 2", parentName: "Mrs. Ngozi Okafor" },
      { id: "STU-1002", name: "Tunde Bakare", className: "JSS 2", parentName: "Mr. Femi Bakare" },
      { id: "STU-1003", name: "Chidinma Eze", className: "SS 1", parentName: "Mrs. Blessing Eze" }
    ];
    var schedules = [
      { id: "SCH-1", title: "Term 1 Tuition", amount: 45000, dueDate: addDays(today, -5), className: "All" },
      { id: "SCH-2", title: "Sports Levy", amount: 5000, dueDate: addDays(today, 4), className: "All" },
      { id: "SCH-3", title: "Excursion Fee", amount: 8000, dueDate: addDays(today, 20), className: "SS 1" }
    ];
    var payments = [];
    var counter = 1;
    schedules.forEach(function (sch) {
      students
        .filter(function (s) { return sch.className === "All" || s.className === sch.className; })
        .forEach(function (s) {
          payments.push({
            id: "PAY-" + counter++,
            studentId: s.id,
            scheduleId: sch.id,
            title: sch.title,
            amount: sch.amount,
            dueDate: sch.dueDate,
            status: "pending",
            paidDate: null,
            method: null,
            reminderSent: false,
            reminderDate: null
          });
        });
    });
    payments[0].status = "paid";
    payments[0].paidDate = addDays(today, -6);
    payments[0].method = "Bank Transfer";

    return { students: students, schedules: schedules, payments: payments, session: null };
  }

  /* ---------------- helpers ---------------- */

  var money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
  function fmtMoney(n) { return money.format(n); }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function daysUntil(iso) {
    var due = new Date(iso + "T00:00:00");
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((due - now) / 86400000);
  }

  function computeStatus(p) {
    if (p.status === "paid") return "paid";
    var d = daysUntil(p.dueDate);
    if (d < 0) return "overdue";
    if (d <= 7) return "due-soon";
    return "upcoming";
  }

  function statusLabel(s) {
    return { paid: "PAID", "due-soon": "DUE SOON", overdue: "OVERDUE", upcoming: "UPCOMING" }[s] || s;
  }

  function studentById(id) {
    return DB.students.filter(function (s) { return s.id === id; })[0];
  }

  function paymentsForStudent(id) {
    return DB.payments.filter(function (p) { return p.studentId === id; });
  }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function classList() {
    var set = {};
    DB.students.forEach(function (s) { set[s.className] = true; });
    return Object.keys(set);
  }

  /* ---------------- toast ---------------- */

  function toast(msg) {
    var root = document.getElementById("toast-root");
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity 200ms ease";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 220);
    }, 3200);
  }

  /* ---------------- root render ---------------- */

  function render() {
    var app = document.getElementById("app");
    if (ui.screen === "cover") {
      app.innerHTML = renderCover();
    } else if (ui.screen === "login-parent") {
      app.innerHTML = renderParentLogin();
    } else if (ui.screen === "login-admin") {
      app.innerHTML = renderAdminLogin();
    } else if (ui.screen === "app" && DB.session) {
      app.innerHTML = DB.session.role === "admin" ? renderAdminApp() : renderParentApp();
    } else {
      ui.screen = "cover";
      app.innerHTML = renderCover();
    }
    var modalHost = document.getElementById("modal-host");
    if (!modalHost) {
      modalHost = document.createElement("div");
      modalHost.id = "modal-host";
      document.body.appendChild(modalHost);
    }
    modalHost.innerHTML = ui.modal ? renderModal() : "";
  }

  /* ---------------- cover ---------------- */

  function renderCover() {
    return (
      '<div class="cover">' +
        '<div class="cover-mark">FEE REGISTER &middot; SCHOOL EDITION</div>' +
        '<div class="cover-plate">' +
          "<h1>Design and Implementation of<br>Mobile Payment Reminder System<br>for Schools</h1>" +
          '<p class="sub">A shared register for school fees: parents see what is due, admin staff keep the schedule and the books.</p>' +
          '<div class="cover-tabs">' +
            '<button class="cover-tab" data-action="goto-login" data-role="parent">' +
              "<strong>Parent / Student</strong>" +
              "<span>View schedules, get reminders, pay fees and keep receipts.</span>" +
            "</button>" +
            '<button class="cover-tab" data-action="goto-login" data-role="admin">' +
              "<strong>Admin / School Staff</strong>" +
              "<span>Manage students, set deadlines, monitor payments and reports.</span>" +
            "</button>" +
          "</div>" +
        "</div>" +
        '<div class="cover-foot">Data is stored only in this browser. Open the admin side first if you want to see how new fees appear for a parent.</div>' +
      "</div>"
    );
  }

  /* ---------------- parent login ---------------- */

  function renderParentLogin() {
    var options = DB.students
      .map(function (s) {
        return '<option value="' + s.id + '">' + escapeHtml(s.name) + " — " + escapeHtml(s.className) + "</option>";
      })
      .join("");
    return (
      '<div class="auth-wrap">' +
        '<div class="auth-card">' +
          '<div class="eyebrow">SIGN IN &middot; MOBILE APP</div>' +
          "<h2>Parent / Student</h2>" +
          (ui.loginError ? '<div class="auth-error">' + escapeHtml(ui.loginError) + "</div>" : "") +
          '<form id="parent-login-form">' +
            '<div class="field">' +
              "<label>Select your child</label>" +
              '<select name="studentId" required>' +
                '<option value="">Choose a student…</option>' +
                options +
              "</select>" +
            "</div>" +
            '<div class="field">' +
              "<label>Your name (parent / guardian)</label>" +
              '<input type="text" name="parentName" placeholder="e.g. Mrs. Ngozi Okafor" required>' +
              '<span class="hint">This appears on receipts and reminder alerts.</span>' +
            "</div>" +
            '<div class="auth-actions">' +
              '<button type="submit" class="btn btn-primary btn-block">Sign In</button>' +
              '<button type="button" class="btn btn-quiet" data-action="goto-cover">Back to cover</button>' +
            "</div>" +
          "</form>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---------------- admin login ---------------- */

  function renderAdminLogin() {
    return (
      '<div class="auth-wrap">' +
        '<div class="auth-card">' +
          '<div class="eyebrow">SIGN IN &middot; WEB DASHBOARD</div>' +
          "<h2>Admin &mdash; School Staff</h2>" +
          (ui.loginError ? '<div class="auth-error">' + escapeHtml(ui.loginError) + "</div>" : "") +
          '<form id="admin-login-form">' +
            '<div class="field">' +
              "<label>Staff name</label>" +
              '<input type="text" name="staffName" placeholder="e.g. Mr. Adewale Johnson" required>' +
            "</div>" +
            '<div class="field">' +
              "<label>Password</label>" +
              '<input type="password" name="password" placeholder="Any password works" required>' +
            "</div>" +
            '<div class="auth-actions">' +
              '<button type="submit" class="btn btn-primary btn-block">Sign In</button>' +
              '<button type="button" class="btn btn-quiet" data-action="goto-cover">Back to cover</button>' +
            "</div>" +
          "</form>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---------------- shell (shared by both apps) ---------------- */

  function renderShell(brandWho, brandName, tabs, contentHtml) {
    var tabButtons = tabs
      .map(function (t) {
        return (
          '<button class="rail-tab' + (ui.tab === t.id ? " active" : "") + '" data-action="set-tab" data-tab="' + t.id + '">' +
            escapeHtml(t.label) +
          "</button>"
        );
      })
      .join("");

    return (
      '<div class="shell">' +
        '<aside class="rail">' +
          '<div class="rail-brand"><div class="who">' + escapeHtml(brandWho) + "</div><strong>" + escapeHtml(brandName) + "</strong></div>" +
          "<nav>" + tabButtons + "</nav>" +
          '<div class="rail-foot"><button class="btn btn-danger btn-block btn-sm" data-action="sign-out">Sign Out</button></div>' +
        "</aside>" +
        '<div style="flex:1; min-width:0; display:flex; flex-direction:column;">' +
          '<div class="mobile-bar">' + tabButtons + "</div>" +
          '<div class="rail-foot-mobile" style="display:none;"></div>' +
          '<main class="main">' + contentHtml + "</main>" +
        "</div>" +
      "</div>"
    );
  }

  /* ================================================================
     PARENT APP
     ================================================================ */

  function renderParentApp() {
    var s = DB.session;
    var student = studentById(s.studentId);
    var content = "";
    if (!student) {
      content = '<div class="empty"><strong>This student record is no longer available.</strong>Please sign out and sign in again.</div>';
    } else if (ui.tab === "reminders") {
      content = renderParentReminders(student);
    } else if (ui.tab === "pay") {
      content = renderParentPay(student);
    } else if (ui.tab === "history") {
      content = renderParentHistory(student);
    } else {
      content = renderParentDashboard(student);
    }
    return renderShell("PARENT / STUDENT PORTAL", s.name, PARENT_TABS, content);
  }

  function renderParentDashboard(student) {
    var payments = paymentsForStudent(student.id);
    var totalDue = payments.filter(function (p) { return p.status !== "paid"; }).reduce(function (a, p) { return a + p.amount; }, 0);
    var overdueCount = payments.filter(function (p) { return computeStatus(p) === "overdue"; }).length;
    var paidCount = payments.filter(function (p) { return p.status === "paid"; }).length;

    var rows = payments
      .slice()
      .sort(function (a, b) { return a.dueDate.localeCompare(b.dueDate); })
      .map(function (p) {
        var st = computeStatus(p);
        var actionCell = p.status === "paid"
          ? '<span class="hint" style="color:var(--ink-faint);font-size:0.82rem;">Settled</span>'
          : '<button class="btn btn-sm btn-primary" data-action="open-pay" data-payment="' + p.id + '">Pay now</button>';
        return (
          "<tr>" +
            '<td data-label="Fee">' + escapeHtml(p.title) + "</td>" +
            '<td data-label="Due date">' + fmtDate(p.dueDate) + "</td>" +
            '<td data-label="Amount" class="num">' + fmtMoney(p.amount) + "</td>" +
            '<td data-label="Status"><span class="stamp ' + st + '">' + statusLabel(st) + "</span></td>" +
            '<td data-label="Action" class="no-label">' + actionCell + "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="topline"><div><h2>Schedules &amp; due dates</h2><div class="meta">' +
        escapeHtml(student.name) + " &middot; " + escapeHtml(student.className) +
      "</div></div></div>" +
      '<div class="stat-strip">' +
        '<div class="stat"><div class="label">FEES ON RECORD</div><div class="value">' + payments.length + "</div></div>" +
        '<div class="stat accent-amber"><div class="label">OUTSTANDING</div><div class="value">' + fmtMoney(totalDue) + "</div></div>" +
        '<div class="stat accent-red"><div class="label">OVERDUE ITEMS</div><div class="value">' + overdueCount + "</div></div>" +
        '<div class="stat accent-green"><div class="label">PAID</div><div class="value">' + paidCount + "</div></div>" +
      "</div>" +
      '<div class="block">' +
        '<div class="block-head"><div><h3>Payment schedule</h3><div class="desc">Every fee assigned to ' + escapeHtml(student.name) + " by the school.</div></div></div>" +
        '<div class="block-body" style="padding:0;">' +
          (rows
            ? '<table class="register"><thead><tr><th>Fee</th><th>Due date</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>"
            : '<div class="register-empty">No fees have been scheduled yet.</div>') +
        "</div>" +
      "</div>"
    );
  }

  function renderParentReminders(student) {
    var payments = paymentsForStudent(student.id).filter(function (p) { return p.status !== "paid"; });
    var items = payments
      .slice()
      .sort(function (a, b) { return a.dueDate.localeCompare(b.dueDate); })
      .map(function (p) {
        var st = computeStatus(p);
        if (st === "upcoming") return null;
        var d = daysUntil(p.dueDate);
        var when = d < 0 ? Math.abs(d) + " day(s) overdue" : d === 0 ? "Due today" : "Due in " + d + " day(s)";
        return (
          '<div class="notice ' + st + '">' +
            '<span class="dot"></span>' +
            '<div class="body">' +
              "<strong>" + escapeHtml(p.title) + " &mdash; " + fmtMoney(p.amount) + "</strong>" +
              '<div class="when">' + when + " &middot; sent as SMS / App Notification</div>" +
            "</div>" +
          "</div>"
        );
      })
      .filter(Boolean)
      .join("");

    return (
      '<div class="topline"><h2>Reminders</h2><div class="meta">Simulated SMS &amp; in-app alerts for ' + escapeHtml(student.name) + "</div></div>" +
      '<div class="block">' +
        '<div class="block-head"><div><h3>Active reminders</h3><div class="desc">Generated automatically as due dates approach or pass.</div></div></div>' +
        '<div class="block-body" style="padding:0;">' +
          (items ? items : '<div class="empty"><strong>All clear.</strong>No fees are due soon or overdue.</div>') +
        "</div>" +
      "</div>"
    );
  }

  function renderParentPay(student) {
    var pending = paymentsForStudent(student.id).filter(function (p) { return p.status !== "paid"; });
    if (!pending.length) {
      return (
        '<div class="topline"><h2>Make a payment</h2></div>' +
        '<div class="empty"><strong>Nothing to pay right now.</strong>Every scheduled fee for ' + escapeHtml(student.name) + " has been settled.</div>"
      );
    }
    var options = pending
      .map(function (p) {
        var st = computeStatus(p);
        return '<option value="' + p.id + '">' + escapeHtml(p.title) + " — " + fmtMoney(p.amount) + " — due " + fmtDate(p.dueDate) + " (" + statusLabel(st) + ")</option>";
      })
      .join("");

    return (
      '<div class="topline"><h2>Make a payment</h2><div class="meta">' + escapeHtml(student.name) + "</div></div>" +
      '<div class="block" style="max-width:520px;">' +
        '<div class="block-head"><h3>Choose a fee to pay</h3></div>' +
        '<div class="block-body">' +
          '<form id="pay-form">' +
            '<div class="field">' +
              "<label>Outstanding fee</label>" +
              '<select name="paymentId">' + options + "</select>" +
            "</div>" +
            '<div class="field">' +
              "<label>Payment method</label>" +
              '<select name="method">' +
                "<option>Card</option>" +
                "<option>Bank Transfer</option>" +
                "<option>USSD</option>" +
                "<option>Mobile Wallet</option>" +
              "</select>" +
            "</div>" +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">Pay now</button></div>' +
          "</form>" +
        "</div>" +
      "</div>"
    );
  }

  function renderParentHistory(student) {
    var paid = paymentsForStudent(student.id).filter(function (p) { return p.status === "paid"; });
    var rows = paid
      .slice()
      .sort(function (a, b) { return (b.paidDate || "").localeCompare(a.paidDate || ""); })
      .map(function (p) {
        return (
          "<tr>" +
            '<td data-label="Fee">' + escapeHtml(p.title) + "</td>" +
            '<td data-label="Paid on">' + fmtDate(p.paidDate) + "</td>" +
            '<td data-label="Amount" class="num">' + fmtMoney(p.amount) + "</td>" +
            '<td data-label="Method">' + escapeHtml(p.method || "—") + "</td>" +
            '<td data-label="Receipt" class="no-label"><button class="btn btn-sm" data-action="view-receipt" data-payment="' + p.id + '">View receipt</button></td>' +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="topline"><h2>Payment history &amp; receipts</h2><div class="meta">' + escapeHtml(student.name) + "</div></div>" +
      '<div class="block">' +
        '<div class="block-head"><h3>Confirmed payments</h3></div>' +
        '<div class="block-body" style="padding:0;">' +
          (rows
            ? '<table class="register"><thead><tr><th>Fee</th><th>Paid on</th><th>Amount</th><th>Method</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>"
            : '<div class="register-empty">No payments have been made yet.</div>') +
        "</div>" +
      "</div>"
    );
  }

  /* ================================================================
     ADMIN APP
     ================================================================ */

  function renderAdminApp() {
    var s = DB.session;
    var content = "";
    if (ui.tab === "students") content = renderAdminStudents();
    else if (ui.tab === "schedules") content = renderAdminSchedules();
    else if (ui.tab === "monitor") content = renderAdminMonitor();
    else if (ui.tab === "reports") content = renderAdminReports();
    else content = renderAdminDashboard();
    return renderShell("ADMIN — SCHOOL STAFF", s.name, ADMIN_TABS, content);
  }

  function renderAdminDashboard() {
    var totalStudents = DB.students.length;
    var totalSchedules = DB.schedules.length;
    var collected = DB.payments.filter(function (p) { return p.status === "paid"; }).reduce(function (a, p) { return a + p.amount; }, 0);
    var pending = DB.payments.filter(function (p) { return p.status !== "paid"; }).reduce(function (a, p) { return a + p.amount; }, 0);
    var overdue = DB.payments.filter(function (p) { return computeStatus(p) === "overdue"; });

    var overdueRows = overdue
      .slice(0, 6)
      .map(function (p) {
        var st = studentById(p.studentId);
        return (
          "<tr>" +
            '<td data-label="Student">' + (st ? escapeHtml(st.name) : "—") + "</td>" +
            '<td data-label="Fee">' + escapeHtml(p.title) + "</td>" +
            '<td data-label="Due date">' + fmtDate(p.dueDate) + "</td>" +
            '<td data-label="Amount" class="num">' + fmtMoney(p.amount) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="topline"><h2>Dashboard</h2><div class="meta">Overview across the whole register</div></div>' +
      '<div class="stat-strip">' +
        '<div class="stat"><div class="label">STUDENTS ON FILE</div><div class="value">' + totalStudents + "</div></div>" +
        '<div class="stat"><div class="label">ACTIVE SCHEDULES</div><div class="value">' + totalSchedules + "</div></div>" +
        '<div class="stat accent-green"><div class="label">COLLECTED</div><div class="value">' + fmtMoney(collected) + "</div></div>" +
        '<div class="stat accent-amber"><div class="label">OUTSTANDING</div><div class="value">' + fmtMoney(pending) + "</div></div>" +
        '<div class="stat accent-red"><div class="label">OVERDUE</div><div class="value">' + overdue.length + "</div></div>" +
      "</div>" +
      '<div class="block">' +
        '<div class="block-head"><div><h3>Most urgent overdue items</h3><div class="desc">Worth a reminder today.</div></div></div>' +
        '<div class="block-body" style="padding:0;">' +
          (overdueRows
            ? '<table class="register"><thead><tr><th>Student</th><th>Fee</th><th>Due date</th><th>Amount</th></tr></thead><tbody>' + overdueRows + "</tbody></table>"
            : '<div class="register-empty">Nothing overdue. The register is up to date.</div>') +
        "</div>" +
      "</div>"
    );
  }

  function renderAdminStudents() {
    var rows = DB.students
      .map(function (s) {
        var count = paymentsForStudent(s.id).length;
        return (
          "<tr>" +
            '<td data-label="ID">' + escapeHtml(s.id) + "</td>" +
            '<td data-label="Name">' + escapeHtml(s.name) + "</td>" +
            '<td data-label="Class">' + escapeHtml(s.className) + "</td>" +
            '<td data-label="Parent / Guardian">' + escapeHtml(s.parentName) + "</td>" +
            '<td data-label="Fee records" class="num">' + count + "</td>" +
            '<td data-label="" class="no-label"><button class="btn btn-sm btn-danger" data-action="remove-student" data-student="' + s.id + '">Remove</button></td>' +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="topline"><h2>Students &amp; payment records</h2></div>' +
      '<div class="block">' +
        '<div class="block-head"><h3>Add a student</h3></div>' +
        '<div class="block-body">' +
          '<form id="add-student-form" class="form-grid">' +
            '<div class="field"><label>Full name</label><input type="text" name="name" placeholder="e.g. Ifeoma Chukwu" required></div>' +
            '<div class="field"><label>Class</label><input type="text" name="className" placeholder="e.g. JSS 1" required></div>' +
            '<div class="field"><label>Parent / guardian name</label><input type="text" name="parentName" placeholder="e.g. Mrs. Ada Chukwu" required></div>' +
            '<div class="field" style="justify-content:flex-end;"><button type="submit" class="btn btn-primary">Add student</button></div>' +
          "</form>" +
        "</div>" +
      "</div>" +
      '<div class="block">' +
        '<div class="block-head"><h3>Student register</h3></div>' +
        '<div class="block-body" style="padding:0;">' +
          (rows
            ? '<table class="register"><thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Parent / Guardian</th><th>Fee records</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>"
            : '<div class="register-empty">No students added yet.</div>') +
        "</div>" +
      "</div>"
    );
  }

  function renderAdminSchedules() {
    var classOptions = ['<option value="All">All classes</option>']
      .concat(classList().map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }))
      .join("");

    var rows = DB.schedules
      .map(function (sc) {
        var count = DB.payments.filter(function (p) { return p.scheduleId === sc.id; }).length;
        var paidCount = DB.payments.filter(function (p) { return p.scheduleId === sc.id && p.status === "paid"; }).length;
        return (
          "<tr>" +
            '<td data-label="Fee">' + escapeHtml(sc.title) + "</td>" +
            '<td data-label="Applies to">' + escapeHtml(sc.className) + "</td>" +
            '<td data-label="Amount" class="num">' + fmtMoney(sc.amount) + "</td>" +
            '<td data-label="Due date">' + fmtDate(sc.dueDate) + "</td>" +
            '<td data-label="Collected" class="num">' + paidCount + " / " + count + "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="topline"><h2>Payment schedules &amp; deadlines</h2></div>' +
      '<div class="block">' +
        '<div class="block-head"><h3>Set a new schedule</h3><div class="desc">A payment record is created automatically for every matching student.</div></div>' +
        '<div class="block-body">' +
          '<form id="add-schedule-form" class="form-grid">' +
            '<div class="field"><label>Fee title</label><input type="text" name="title" placeholder="e.g. Term 2 Tuition" required></div>' +
            '<div class="field"><label>Amount (₦)</label><input type="number" name="amount" min="1" step="1" placeholder="e.g. 45000" required></div>' +
            '<div class="field"><label>Due date</label><input type="date" name="dueDate" required></div>' +
            '<div class="field"><label>Applies to</label><select name="className">' + classOptions + "</select></div>" +
            '<div class="field" style="justify-content:flex-end;"><button type="submit" class="btn btn-primary">Create schedule</button></div>' +
          "</form>" +
        "</div>" +
      "</div>" +
      '<div class="block">' +
        '<div class="block-head"><h3>Active schedules</h3></div>' +
        '<div class="block-body" style="padding:0;">' +
          (rows
            ? '<table class="register"><thead><tr><th>Fee</th><th>Applies to</th><th>Amount</th><th>Due date</th><th>Collected</th></tr></thead><tbody>' + rows + "</tbody></table>"
            : '<div class="register-empty">No schedules created yet.</div>') +
        "</div>" +
      "</div>"
    );
  }

  function renderAdminMonitor() {
    var rows = DB.payments
      .slice()
      .sort(function (a, b) {
        var order = { overdue: 0, "due-soon": 1, upcoming: 2, paid: 3 };
        return order[computeStatus(a)] - order[computeStatus(b)] || a.dueDate.localeCompare(b.dueDate);
      })
      .map(function (p) {
        var st = computeStatus(p);
        var student = studentById(p.studentId);
        var action;
        if (p.status === "paid") {
          action = '<span class="hint" style="color:var(--ink-faint);font-size:0.82rem;">Settled</span>';
        } else if (p.reminderSent) {
          action = '<span class="hint" style="color:var(--ink-faint);font-size:0.82rem;">Sent ' + fmtDate(p.reminderDate) + "</span>";
        } else {
          action = '<button class="btn btn-sm" data-action="send-reminder" data-payment="' + p.id + '">Send reminder</button>';
        }
        return (
          "<tr>" +
            '<td data-label="Student">' + (student ? escapeHtml(student.name) : "—") + "</td>" +
            '<td data-label="Fee">' + escapeHtml(p.title) + "</td>" +
            '<td data-label="Due date">' + fmtDate(p.dueDate) + "</td>" +
            '<td data-label="Amount" class="num">' + fmtMoney(p.amount) + "</td>" +
            '<td data-label="Status"><span class="stamp ' + st + '">' + statusLabel(st) + "</span></td>" +
            '<td data-label="Reminder" class="no-label">' + action + "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="topline"><h2>Monitor payments &amp; generate reminders</h2></div>' +
      '<div class="block">' +
        '<div class="block-head"><h3>All payment records</h3><div class="desc">Sorted with the most urgent items first.</div></div>' +
        '<div class="block-body" style="padding:0;">' +
          (rows
            ? '<table class="register"><thead><tr><th>Student</th><th>Fee</th><th>Due date</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>"
            : '<div class="register-empty">No payment records yet.</div>') +
        "</div>" +
      "</div>"
    );
  }

  function renderAdminReports() {
    var collected = DB.payments.filter(function (p) { return p.status === "paid"; }).reduce(function (a, p) { return a + p.amount; }, 0);
    var expected = DB.payments.reduce(function (a, p) { return a + p.amount; }, 0);
    var overdueAmt = DB.payments.filter(function (p) { return computeStatus(p) === "overdue"; }).reduce(function (a, p) { return a + p.amount; }, 0);

    var bars = DB.schedules
      .map(function (sc) {
        var related = DB.payments.filter(function (p) { return p.scheduleId === sc.id; });
        var total = related.reduce(function (a, p) { return a + p.amount; }, 0);
        var got = related.filter(function (p) { return p.status === "paid"; }).reduce(function (a, p) { return a + p.amount; }, 0);
        var pct = total ? Math.round((got / total) * 100) : 0;
        return (
          '<div class="bar-row">' +
            '<div class="name">' + escapeHtml(sc.title) + "</div>" +
            '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="amt">' + pct + "%</div>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="topline"><h2>Reports &amp; analytics</h2></div>' +
      '<div class="stat-strip">' +
        '<div class="stat"><div class="label">TOTAL EXPECTED</div><div class="value">' + fmtMoney(expected) + "</div></div>" +
        '<div class="stat accent-green"><div class="label">TOTAL COLLECTED</div><div class="value">' + fmtMoney(collected) + "</div></div>" +
        '<div class="stat accent-red"><div class="label">OVERDUE AMOUNT</div><div class="value">' + fmtMoney(overdueAmt) + "</div></div>" +
      "</div>" +
      '<div class="block">' +
        '<div class="block-head"><h3>Collection rate by fee schedule</h3></div>' +
        '<div class="block-body">' + (bars || '<div class="register-empty">No schedules yet.</div>') + "</div>" +
      "</div>"
    );
  }

  /* ================================================================
     Modal (pay confirmation / receipt view)
     ================================================================ */

  function renderModal() {
    if (!ui.modal) return "";
    if (ui.modal.type === "receipt") {
      var p = DB.payments.filter(function (x) { return x.id === ui.modal.paymentId; })[0];
      if (!p) return "";
      var student = studentById(p.studentId);
      return (
        '<div class="modal-veil" data-action="close-modal">' +
          '<div class="modal-card" onclick="event.stopPropagation()">' +
            '<div class="modal-head"><h3 style="margin:0;">Receipt</h3><button class="btn btn-quiet btn-sm" data-action="close-modal">Close</button></div>' +
            '<div class="receipt">' +
              "<h3>" + escapeHtml(p.title) + "</h3>" +
              '<div class="ref">Ref: ' + escapeHtml(p.id) + "</div>" +
              '<div class="receipt-row"><span class="k">Student</span><span class="v">' + (student ? escapeHtml(student.name) : "—") + "</span></div>" +
              '<div class="receipt-row"><span class="k">Amount</span><span class="v">' + fmtMoney(p.amount) + "</span></div>" +
              '<div class="receipt-row"><span class="k">Paid on</span><span class="v">' + fmtDate(p.paidDate) + "</span></div>" +
              '<div class="receipt-row"><span class="k">Method</span><span class="v">' + escapeHtml(p.method || "—") + "</span></div>" +
              '<div class="stamp-wrap"><span class="stamp paid">PAID</span></div>' +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }
    return "";
  }

  /* ================================================================
     Actions / event handling
     ================================================================ */

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");

    if (action === "goto-login") {
      ui.loginError = "";
      ui.screen = el.getAttribute("data-role") === "admin" ? "login-admin" : "login-parent";
      render();
    } else if (action === "goto-cover") {
      ui.screen = "cover";
      render();
    } else if (action === "set-tab") {
      ui.tab = el.getAttribute("data-tab");
      render();
    } else if (action === "sign-out") {
      DB.session = null;
      saveData();
      ui.screen = "cover";
      ui.tab = null;
      render();
    } else if (action === "open-pay") {
      ui.tab = "pay";
      render();
    } else if (action === "view-receipt") {
      ui.modal = { type: "receipt", paymentId: el.getAttribute("data-payment") };
      render();
    } else if (action === "close-modal") {
      ui.modal = null;
      render();
    } else if (action === "send-reminder") {
      var pid = el.getAttribute("data-payment");
      var payment = DB.payments.filter(function (p) { return p.id === pid; })[0];
      if (payment) {
        payment.reminderSent = true;
        payment.reminderDate = new Date().toISOString().slice(0, 10);
        saveData();
        var st = studentById(payment.studentId);
        toast("Reminder sent to " + (st ? st.parentName : "parent") + " for " + payment.title);
        render();
      }
    } else if (action === "remove-student") {
      var sid = el.getAttribute("data-student");
      DB.students = DB.students.filter(function (s) { return s.id !== sid; });
      DB.payments = DB.payments.filter(function (p) { return p.studentId !== sid; });
      saveData();
      toast("Student record removed.");
      render();
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target;

    if (form.id === "parent-login-form") {
      e.preventDefault();
      var studentId = form.studentId.value;
      var parentName = form.parentName.value.trim();
      if (!studentId || !parentName) {
        ui.loginError = "Please choose a student and enter your name.";
        render();
        return;
      }
      DB.session = { role: "parent", studentId: studentId, name: parentName };
      saveData();
      ui.screen = "app";
      ui.tab = "dashboard";
      ui.loginError = "";
      render();
    }

    if (form.id === "admin-login-form") {
      e.preventDefault();
      var staffName = form.staffName.value.trim();
      if (!staffName) {
        ui.loginError = "Please enter your name.";
        render();
        return;
      }
      DB.session = { role: "admin", name: staffName };
      saveData();
      ui.screen = "app";
      ui.tab = "dashboard";
      ui.loginError = "";
      render();
    }

    if (form.id === "pay-form") {
      e.preventDefault();
      var payId = form.paymentId.value;
      var method = form.method.value;
      var pay = DB.payments.filter(function (p) { return p.id === payId; })[0];
      if (pay) {
        pay.status = "paid";
        pay.paidDate = new Date().toISOString().slice(0, 10);
        pay.method = method;
        saveData();
        toast("Payment confirmed for " + pay.title + ".");
        ui.tab = "history";
        ui.modal = { type: "receipt", paymentId: pay.id };
        render();
      }
    }

    if (form.id === "add-student-form") {
      e.preventDefault();
      var name = form.name.value.trim();
      var className = form.className.value.trim();
      var parentNm = form.parentName.value.trim();
      if (!name || !className || !parentNm) return;
      DB.students.push({ id: uid("STU"), name: name, className: className, parentName: parentNm });
      saveData();
      toast(name + " added to the student register.");
      form.reset();
      render();
    }

    if (form.id === "add-schedule-form") {
      e.preventDefault();
      var title = form.title.value.trim();
      var amount = parseFloat(form.amount.value);
      var dueDate = form.dueDate.value;
      var cls = form.className.value;
      if (!title || !amount || !dueDate) return;
      var schedule = { id: uid("SCH"), title: title, amount: amount, dueDate: dueDate, className: cls };
      DB.schedules.push(schedule);
      DB.students
        .filter(function (s) { return cls === "All" || s.className === cls; })
        .forEach(function (s) {
          DB.payments.push({
            id: uid("PAY"),
            studentId: s.id,
            scheduleId: schedule.id,
            title: title,
            amount: amount,
            dueDate: dueDate,
            status: "pending",
            paidDate: null,
            method: null,
            reminderSent: false,
            reminderDate: null
          });
        });
      saveData();
      toast("Schedule created and applied to matching students.");
      form.reset();
      render();
    }
  });

  render();
})();
