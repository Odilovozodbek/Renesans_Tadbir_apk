/* The server sets data-mode on its own HTML response. Opening index.html uses the local demo. */
const LIVE = document.documentElement.dataset.mode === "campus";
const Campus = (() => {
  let signedIn = false;
  let csrf = "";
  let revision = 0;
  let offline = false;
  let loading = true;
  const jobKeys = new Set();
  const accountKind = {student: "Talaba", teacher: "Ustoz", tutor: "Tyutor", admin: "Mas’ul"};

  function blank() {
    return {profile: {id: "", name: "", group: "", university: ""}, role: "student", settings: {...DEFAULT_SETTINGS},
      events: [], registrations: [], evidence: [], orders: {}, activity: [], savedEventIds: [], universities: []};
  }
  function prefsKey() { return "renesans-campus-view-" + state.profile.id; }
  function storeView() {
    try {
      localStorage.setItem(prefsKey(), JSON.stringify({settings: state.settings, saved: state.savedEventIds}));
      return true;
    } catch {
      toast("Qurilma sozlamalarini saqlab bo‘lmadi.", "error");
      return false;
    }
  }
  function clearSession() {
    revision++;
    csrf = "";
    signedIn = false;
    state = blank();
    filters = defaultFilters();
    closeDialog();
    document.documentElement.dataset.session = "guest";
    applyPreferences();
    render();
  }
  async function request(path, options = {}) {
    const {body, method = body === undefined ? "GET" : "POST", binary = false} = options;
    const headers = {};
    let payload = body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (method === "POST" && csrf) headers["X-CSRF-Token"] = csrf;
    let response;
    try {
      response = await fetch(path, {method, credentials: "same-origin", cache: "no-store", headers, body: payload});
    } catch {
      throw Error("Serverga ulanib bo‘lmadi. Aloqani tekshirib, qayta urining.");
    }
    if (response.status === 401 && path !== "/api/login") {
      loading = false;
      offline = false;
      clearSession();
      throw Error("Davom etish uchun hisobingizga kiring.");
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw Error(problem.error || "Amalni bajarib bo‘lmadi. Sahifani yangilang.");
    }
    return binary ? response.blob() : response.json();
  }
  async function refresh() {
    const version = ++revision;
    const snapshot = await request("/api/state");
    if (version !== revision) return;
    const changed = !signedIn || state.profile.id !== snapshot.profile.id;
    signedIn = true;
    loading = offline = false;
    csrf = snapshot.csrf;
    delete snapshot.csrf;
    state = {...blank(), ...snapshot};
    const roleSelect = $("#roleSelect");
    if (roleSelect) {
      roleSelect.replaceChildren(new Option(accountKind[state.profile.kind] || "Universitet akkaunti", state.profile.kind));
      roleSelect.disabled = true;
      roleSelect.setAttribute("aria-label", "Universitet bergan rol");
    }
    let view;
    try { view = JSON.parse(localStorage.getItem(prefsKey())); } catch { view = null; }
    state.settings = normalizeSettings(view?.settings);
    state.savedEventIds = Array.isArray(view?.saved) ? view.saved.filter(id => eventById(id)?.status === "approved") : [];
    if (changed) {
      filters = defaultFilters();
      reviewTab = "pending";
      portfolioYear = "";
    }
    document.documentElement.dataset.session = "member";
    applyPreferences();
    render();
  }
  async function start() {
    try { await refresh(); }
    catch (error) {
      loading = false;
      if (!signedIn && !document.querySelector("#campusLogin")) {
        offline = true;
        clearSession();
      } else if (signedIn) toast(error.message, "error");
    }
  }
  function guest() {
    document.documentElement.dataset.session = "guest";
    document.title = "Universitet hisobiga kirish — Renesans";
    if (loading || offline) {
      main.innerHTML = '<section class="panel campus-entry"><h1>Renesans Tadbirlar</h1><p>' +
        (loading ? "Hisob tekshirilmoqda…" : "Serverga ulanishni tiklab, qayta urining.") +
        '</p>' + (loading ? '' : '<button class="button button-primary" data-action="campus-refresh">Qayta urinish</button>') + '</section>';
      return;
    }
    main.innerHTML = `<section class="panel campus-entry">
      <div class="doc-icon">${icon("university")}</div><h1>Universitet hisobiga kirish</h1>
      <p>Tadbirga yozilish, hisobot joylash va shaxsiy NB hujjatingizni olish uchun universitet bergan ID va parolni kiriting.</p>
      <form id="campusLogin" class="dialog-form">
        <div class="field"><label for="accountId">Universitet IDsi</label><input id="accountId" name="login" required maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false"></div>
        <div class="field"><label for="accountPassword">Parol</label><input id="accountPassword" type="password" name="password" required maxlength="256" autocomplete="current-password"></div>
        <p class="form-error" role="alert"></p><button class="button button-primary" type="submit">Kirish</button>
      </form></section>`;
  }
  function chrome() {
    const badge = $(".demo-badge");
    badge.textContent = "Kampus";
    const select = $("#roleSelect");
    select.disabled = true;
    select.setAttribute("aria-label", "Universitet bergan rol");
    const exit = $(".demo-info");
    exit.dataset.action = "campus-logout";
    exit.textContent = "Hisobdan chiqish";
    $("#topbarAvatar").setAttribute("aria-label", "Hisobim");
  }
  function summary() {
    const p = state.profile;
    return `<div class="campus-person"><h3>${h(p.name)}</h3><p>${h(accountKind[p.kind])} · ${h(p.group)}</p>
      <p>${h(p.university)}</p><p>Universitet IDsi <strong>${h(p.id)}</strong></p></div>`;
  }
  function account() {
    showDialog(modalHead("Universitet hisobim") + `<div class="dialog-body">${summary()}
      <div class="dialog-footer"><a href="#settings" class="button button-light">Sozlamalar</a>
      <button class="button button-primary" data-action="campus-logout">Hisobdan chiqish</button></div></div>`);
  }
  function decorate(route) {
    if (route === "settings") {
      $(".settings-data")?.remove();
      const profile = $("#settingsProfileForm");
      if (profile) {
        profile.innerHTML = '<h2>Universitet hisobim</h2>' + summary() +
          '<p class="panel-description">Guvohnomadagi ma’lumot o‘zgargan bo‘lsa, universitet mas’uliga murojaat qiling.</p>' +
          '<button type="button" class="button button-light" data-action="campus-logout">Hisobdan chiqish</button>';
      }
    }
    if (route === "create") {
      const kind = $("#eventOrganizerType");
      if (kind) {
        kind.replaceChildren(new Option(accountKind[state.profile.kind]));
        kind.disabled = true;
      }
    }
  }
  async function run(key, callback, form = null) {
    if (jobKeys.has(key)) return;
    jobKeys.add(key);
    const button = form?.querySelector('[type="submit"]');
    const errorBox = form?.querySelector(".form-error");
    if (button) button.disabled = true;
    if (errorBox) errorBox.textContent = "";
    try { await callback(); }
    catch (e) {
      if (errorBox?.isConnected) errorBox.textContent = e.message;
      else toast(e.message, "error");
    } finally {
      jobKeys.delete(key);
      if (button) button.disabled = false;
    }
  }
  const eventPath = (id, action) => "/api/events/" + encodeURIComponent(id) + "/" + action;
  async function change(path, body, message, next) {
    await request(path, {body});
    closeDialog();
    await refresh();
    if (next) await next();
    if (message) toast(message);
  }
  function joinForm(id) {
    const e = eventById(id);
    if (!e || !canJoin(e)) return toast("Bu tadbir uchun yozilish yopiq.", "error");
    showDialog(modalHead("Tadbirga yozilish", e.title) + `<div class="dialog-body"><form id="joinForm" data-id="${h(id)}" class="dialog-form">
      ${summary()}${state.profile.kind === "student" ? `<label class="check-field"><input type="checkbox" name="needsDocument" ${e.orderNeeded ? "checked" : ""}>
      <span>Tadbir darsimga to‘g‘ri keladi. NB hujjati kerak.</span></label>` : ""}
      <p class="form-error" role="alert"></p><div class="dialog-footer"><button class="button button-light" type="button" data-action="close">Orqaga</button>
      <button class="button button-primary" type="submit">Ishtirokni tasdiqlash</button></div></form></div>`);
  }
  async function participants(id) {
    const rows = await request(eventPath(id, "roster"));
    const e = eventById(id);
    if (!e || state.role !== "admin") return;
    const items = rows.map(r => `<tr><td>${h(r.name)}<span class="table-sub">${h(r.studentId)} · ${h(r.group)}</span></td>
      <td>${r.checkedAt ? "Tasdiqlangan" : "Kelishi kutilmoqda"}</td><td><button class="button button-light button-small"
      data-action="campus-attendance" data-id="${h(id)}" data-reg="${h(r.id)}" data-present="${!r.checkedAt}"
      data-person="${h(r.name)}" data-identity="${h(r.studentId)}">${r.checkedAt ? "Tasdiqni bekor qilish" : "Kelganini belgilash"}</button></td></tr>`).join("");
    showDialog(modalHead("Ishtirokchilar", e.title) + `<div class="dialog-body">${rows.length ?
      `<div class="table-wrap"><table class="data-table"><thead><tr><th>Ishtirokchi</th><th>Qatnashuv</th><th>Amal</th></tr></thead><tbody>${items}</tbody></table></div>`
      : "<p>Hali hech kim yozilmagan.</p>"}<div class="dialog-footer">
      ${rows.length ? `<button class="button button-light" data-action="export-participants" data-id="${h(id)}">CSVni yuklab olish</button>` : ""}
      <button class="button button-primary" data-action="close">Yopish</button></div></div>`);
  }
  function attendanceForm(button) {
    const {id, reg, present, person, identity} = button.dataset;
    const yes = present === "true";
    showDialog(modalHead(yes ? "Qatnashuvni tasdiqlash" : "Tasdiqni bekor qilish", person + " · " + identity) +
      `<div class="dialog-body"><form id="attendanceForm" data-id="${h(id)}" data-reg="${h(reg)}" data-present="${yes}" class="dialog-form">
      ${yes ? '<p>Talaba guvohnomasidagi IDni solishtiring va uning tadbir chiptasidagi kodni kiriting.</p><div class="field"><label for="doorTicket">Kirish chiptasi kodi</label><input name="ticket" id="doorTicket" required maxlength="40" autocomplete="off"></div>' :
        '<p>Shu ishtirok bo‘yicha berilgan NB kodi bekor qilinadi.</p>'}
      <p class="form-error" role="alert"></p><div class="dialog-footer"><button class="button button-light" type="button" data-action="participants" data-id="${h(id)}">Orqaga</button>
      <button class="button button-primary" type="submit">${yes ? "Qatnashdi" : "Tasdiqni bekor qilish"}</button></div></form></div>`);
  }
  function verifyForm() {
    showDialog(modalHead("NB kodini tekshirish", "Shtrix kodni skanerlang yoki PDFdagi kodni yozing.") +
      `<div class="dialog-body"><form id="verifyForm" class="dialog-form">
      <div class="field"><label for="verifyCode">NB kodi</label><input id="verifyCode" name="code" required maxlength="80" autocomplete="off"></div>
      <div class="field"><label for="verifyStudent">Talaba guvohnomasidagi ID</label><input id="verifyStudent" name="studentId" required maxlength="40" autocomplete="off"></div>
      <p class="form-error" role="alert"></p><button class="button button-primary" type="submit">Tekshirish</button></form></div>`);
  }
  async function inspect(body) {
    const found = await request("/api/verify", {body});
    showDialog(modalHead(found.usedAt ? "Hujjat avval qabul qilingan" : "Hujjat va talaba IDsi mos", found.title) +
      `<div class="dialog-body"><p><strong>${h(found.name)}</strong> · ${h(found.studentId)} · ${h(found.group)}</p>
      <p>${h(found.date)} · Buyruq № ${h(found.number)}</p><div class="dialog-footer">
      <button class="button button-light" data-action="close">Yopish</button>
      ${found.usedAt ? "" : `<button class="button button-primary" data-action="campus-redeem" data-code="${h(body.code)}"
            data-identity="${h(body.studentId)}">Bir marta qabul qilish</button>`}</div></div>`);
  }
  function saveBlob(blob, name) {
    const link = document.createElement("a"), url = URL.createObjectURL(blob);
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function exportRoster(id) {
    const rows = await request(eventPath(id, "roster"));
    const escapeCell = v => '"' + String(v ?? "").replace(/^[\s]*[=+@-]/, "’$&").replace(/"/g, '""') + '"';
    const csv = [["Ism", "ID", "Guruh", "Universitet", "Qatnashdi", "NB so‘rovi"], ...rows.map(r =>
      [r.name, r.studentId, r.group, r.university, r.checkedAt ? "Ha" : "Yo‘q", r.needsDocument ? "Ha" : "Yo‘q"])];
    saveBlob(new Blob(["\uFEFF" + csv.map(row => row.map(escapeCell).join(",")).join("\r\n")], {type: "text/csv;charset=utf-8"}), "ishtirokchilar.csv");
  }
  function click(action, button) {
    const id = button.dataset.id;
    const actions = {
      "campus-refresh": start,
      "campus-logout": async () => { await request("/api/logout", {body: {}}); clearSession(); },
      profile: account, join: () => joinForm(id), participants: () => participants(id),
      "campus-attendance": () => attendanceForm(button), "campus-verify": verifyForm,
      "campus-redeem": () => change("/api/redeem", {code: button.dataset.code, studentId: button.dataset.identity}, "Hujjat qabul qilindi."),
      "confirm-document": () => change(eventPath(id, "request"), {}, "NB so‘rovi yuborildi."),
      "confirm-cancel": () => change(eventPath(id, "cancel"), {}, "Yozuv bekor qilindi."),
      "export-participants": () => exportRoster(id),
      "download-order": async () => saveBlob(await request(eventPath(id, "order"), {binary: true}), "universitet-buyrugi.pdf"),
      "download-personal-order": async () => saveBlob(await request(eventPath(id, "certificate"), {binary: true}), "NB-" + id + ".pdf"),
      about: () => showDialog(modalHead("Renesans Tadbirlar") + '<div class="dialog-body"><p>Universitet hisobingiz bilan tadbirlarga yoziling, qatnashuv va hujjatlaringizni kuzating. Mas’ullar NB ko‘chirmasini guvohnomadagi ID orqali qabul qiladi.</p><div class="dialog-footer"><button data-action="close" class="button button-primary">Yopish</button></div></div>'),
    };
    if (!Object.hasOwn(actions, action)) return false;
    run(action + (id || ""), actions[action]);
    return true;
  }
  function submit(form) {
    const id = form.dataset.id;
    const data = new FormData(form), fields = Object.fromEntries(data);
    const actions = {
      campusLogin: async () => { await request("/api/login", {body: fields}); await refresh(); },
      joinForm: () => change(eventPath(id, "join"), {needsDocument: data.has("needsDocument")}, "Ro‘yxatdan o‘tdingiz.", () => showTicket(id)),
      createForm: () => change("/api/events", {...fields, orderNeeded: data.has("orderNeeded")}, "Tadbir taklifi yuborildi.", () => {location.hash = "registrations";}),
      decisionForm: () => change(eventPath(id, "decision"), {decision: form.dataset.decision, note: fields.note}, "Qaror saqlandi."),
      attendanceForm: () => change(eventPath(id, "attendance"), {registrationId: form.dataset.reg,
        present: form.dataset.present === "true", ticket: fields.ticket}, "Qatnashuv qaydi saqlandi.", () => participants(id)),
      orderForm: () => change(eventPath(id, "order"), data, "Universitet buyrug‘i biriktirildi."),
      evidenceForm: () => {
        const reg = state.registrations.find(r => r.id === fields.registrationId && r.attended);
        if (!reg) throw Error("Tasdiqlangan ishtirokni tanlang.");
        if (!fields.file || fields.file.size > 12 * 1024 * 1024) throw Error("12 MB gacha fayl tanlang.");
        portfolioYear = eventById(reg.eventId).date.slice(0, 4);
        return change(eventPath(reg.eventId, "report"), data, "Hisobot portfelga qo‘shildi.");
      },
      verifyForm: () => inspect(fields)
    };
    if (Object.hasOwn(actions, form.id)) run(form.id, actions[form.id], form);
  }
  return {blank, storeView, start, refresh, guest, chrome, decorate, click, submit, get signedIn() { return signedIn; }};
})();
