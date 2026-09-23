const SB_URL = "https://tqfocdktvjuwoiyfgesb.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm9jZGt0dmp1d29peWZnZXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NTIsImV4cCI6MjEwNTQ4NDQ1Mn0.8TW4fQCQHc4c_xTNBEwOK3lSC9HYCbkTbfXuYQB-S8g";

const sb = window.supabase.createClient(SB_URL, SB_KEY);

const stage = document.getElementById("stage");
const toastEl = document.getElementById("toast");
const sheet = document.getElementById("auth-sheet");
const authSlot = document.getElementById("auth-slot");
const clockTime = document.getElementById("clock-time");

let session = null;
let view = "home";

function toast(msg) {
  toastEl.hidden = false;
  toastEl.textContent = msg;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => (toastEl.hidden = true), 2800);
}

function remaining() {
  const n = new Date();
  const next = new Date(n);
  next.setMinutes(60, 0, 0);
  const s = Math.max(0, Math.floor((next - n) / 1000));
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

function tick() {
  clockTime.textContent = remaining();
}
setInterval(tick, 1000);
tick();

function setAuthUI() {
  if (session) {
    const mail = session.user.email || "you";
    authSlot.innerHTML = `<button class="btn tiny ghost" id="out">${mail.split("@")[0]} · out</button>`;
    authSlot.querySelector("#out").onclick = async () => {
      await sb.auth.signOut();
    };
  } else {
    authSlot.innerHTML = `<button class="btn tiny" id="in">Sign in</button>`;
    authSlot.querySelector("#in").onclick = () => sheet.showModal();
  }
}

async function ensureProfile() {
  if (!session) return;
  const id = session.user.id;
  const handle = (session.user.email || "guest").split("@")[0].slice(0, 24);
  await sb.from("profiles").upsert({
    id,
    handle,
    display_name: handle,
  });
}

async function loadHour() {
  const { data } = await sb.from("hours").select("*").order("slot", { ascending: false }).limit(1);
  return data && data[0];
}

async function loadFeatures() {
  const { data } = await sb.from("features").select("*").order("created_at", { ascending: false }).limit(1);
  return data && data[0];
}

async function loadPublicNotes() {
  const { data } = await sb
    .from("notes")
    .select("id,title,body,created_at,user_id,is_public")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(40);
  return data || [];
}

async function loadMine() {
  if (!session) return [];
  const { data } = await sb
    .from("notes")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });
  return data || [];
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function card(n, i) {
  return `<article class="card" style="animation-delay:${i * 40}ms">
    <p class="meta">${new Date(n.created_at).toLocaleString()}</p>
    <h3>${esc(n.title)}</h3>
    <p>${esc(n.body)}</p>
  </article>`;
}

async function render() {
  document.querySelectorAll("[data-nav]").forEach((b) => {
    b.classList.toggle("on", b.dataset.nav === view);
  });

  if (view === "home" || view === "hour") {
    const [hour, feat, notes] = await Promise.all([loadHour(), loadFeatures(), loadPublicNotes()]);
    const headline = (feat && feat.title) || (hour && hour.headline) || "The glass is still warm.";
    const body =
      (feat && feat.body) ||
      (hour && hour.editorial) ||
      "Every hour this desk turns a page. Pin a note to the street and it stays in public view.";
    stage.innerHTML = `
      <section class="hero">
        <p class="kicker">Edition · ${new Date().toUTCString().slice(17, 22)} UTC</p>
        <h1>${esc(headline)}</h1>
        <p class="lede">${esc(body)}</p>
      </section>
      <div class="grid">${notes.slice(0, 6).map(card).join("") || `<p class="empty">The street is quiet. Be the first to pin something.</p>`}</div>`;
    return;
  }

  if (view === "street") {
    const notes = await loadPublicNotes();
    stage.innerHTML = `
      <section class="hero">
        <p class="kicker">Public rail</p>
        <h1>On the street</h1>
        <p class="lede">Anything a person marked public lives here. Private notes never leave the desk.</p>
      </section>
      <div class="list">${
        notes
          .map(
            (n, i) =>
              `<article class="note" style="animation-delay:${i * 30}ms"><p class="meta">${new Date(
                n.created_at
              ).toLocaleString()}</p><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`
          )
          .join("") || `<p class="empty">Nothing public yet.</p>`
      }</div>`;
    return;
  }

  if (view === "desk") {
    if (!session) {
      stage.innerHTML = `
        <section class="hero">
          <p class="kicker">Locked drawer</p>
          <h1>Your desk</h1>
          <p class="lede">Sign in to keep notes. Mark one public and it walks out to the street.</p>
          <p><button class="btn" id="open-auth">Sign in</button></p>
        </section>`;
      stage.querySelector("#open-auth").onclick = () => sheet.showModal();
      return;
    }
    const mine = await loadMine();
    stage.innerHTML = `
      <section class="hero">
        <p class="kicker">Desk</p>
        <h1>Write something that stays</h1>
      </section>
      <form class="compose" id="compose">
        <label>Title<input name="title" required maxlength="120" /></label>
        <label>Body<textarea name="body" required maxlength="8000"></textarea></label>
        <label class="check"><input type="checkbox" name="pub" /> Mark public — show on the street</label>
        <button class="btn" type="submit">Save</button>
      </form>
      <div class="list">${
        mine
          .map(
            (n) =>
              `<article class="note"><p class="meta">${n.is_public ? "public" : "private"} · ${new Date(
                n.created_at
              ).toLocaleString()}</p><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`
          )
          .join("") || `<p class="empty">Drawer is empty.</p>`
      }</div>`;
    stage.querySelector("#compose").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const { error } = await sb.from("notes").insert({
        user_id: session.user.id,
        title: String(fd.get("title")).trim(),
        body: String(fd.get("body")).trim(),
        is_public: fd.get("pub") === "on",
      });
      if (error) toast(error.message);
      else {
        toast(fd.get("pub") === "on" ? "Pinned to the street." : "Saved in the drawer.");
        render();
      }
    };
  }
}

document.querySelectorAll("[data-nav]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    view = el.dataset.nav === "home" ? "home" : el.dataset.nav;
    render();
  });
});

document.getElementById("auth-close").onclick = () => sheet.close();

document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email"));
  const password = String(fd.get("password"));
  const mode = e.submitter && e.submitter.value;
  let error;
  if (mode === "up") {
    ({ error } = await sb.auth.signUp({ email, password }));
  } else {
    ({ error } = await sb.auth.signInWithPassword({ email, password }));
  }
  if (error) toast(error.message);
  else {
    sheet.close();
    toast(mode === "up" ? "Check your inbox if confirmation is on. Otherwise you are in." : "Welcome back.");
  }
});

sb.auth.onAuthStateChange(async (_e, s) => {
  session = s;
  setAuthUI();
  if (s) await ensureProfile();
  render();
});

sb.auth.getSession().then(({ data }) => {
  session = data.session;
  setAuthUI();
  render();
});
