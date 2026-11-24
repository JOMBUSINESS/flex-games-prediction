const API_BASE = window.FLEX_API_URL || "";
const overlay = document.getElementById("auth-overlay");
const content = document.getElementById("auth-content");
const message = document.getElementById("auth-message");

function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
}
function showMessage(text) { message.textContent = text || ""; }
function closeAuth() { overlay.hidden = true; }
function passwordField(name, label, autocomplete) {
  return `<label for="${name}">${label}</label>
    <div class="password-wrap">
      <input id="${name}" name="${name}" type="password" autocomplete="${autocomplete}" required>
      <button class="password-toggle" type="button" data-password-target="${name}" aria-label="Show password" aria-pressed="false">Show</button>
    </div>`;
}
document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-password-target]");
  if (!toggle) return;
  const input = document.getElementById(toggle.dataset.passwordTarget);
  if (!input) return;
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  toggle.textContent = visible ? "Hide" : "Show";
  toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  toggle.setAttribute("aria-pressed", String(visible));
});

function closeAuth() { overlay.hidden = true; }
function showAuth(mode) {
  overlay.hidden = false;
  showMessage("");
  if (mode === "register") {
    content.innerHTML = `
      <h2>Create Account</h2>
      <form id="register-form">
        <label>Full Name</label><input name="full_name" autocomplete="name" maxlength="120" required>
        <label>Email Address</label><input name="email" type="email" autocomplete="email" required>
        <label>Country</label>
        <select name="country" required>
          <option value="">Select Country</option><option>Ghana</option><option>Nigeria</option>
          <option>Kenya</option><option>Uganda</option><option>South Africa</option><option>Cameroon</option>
        </select>
        <label>Phone Number (include country code)</label><input name="phone" placeholder="+233..." autocomplete="tel" required>
        ${passwordField("password", "Password", "new-password")}
        ${passwordField("confirmPassword", "Confirm Password", "new-password")}
        <button class="btn btn-primary">Create Account</button>
      </form>
      <p class="switch" onclick="showAuth('login')">Already registered? Login</p>`;
    document.getElementById("register-form").onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      try {
        const response = await api("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok) return showMessage(result.message);
        showOtp(data.phone);
      } catch { showMessage("Unable to connect to the server."); }
    };
  } else if (mode === "login") {
    content.innerHTML = `
      <h2>Welcome Back</h2>
      <form id="login-form">
        <label>Phone Number</label><input name="phone" autocomplete="tel" required>
        ${passwordField("password", "Password", "current-password")}
        <button class="btn btn-primary">Login</button>
      </form>
      <p class="switch" onclick="showAuth('forgot')">Forgot your password?</p>
      <p class="switch" onclick="showAuth('register')">Create an account</p>`;
    document.getElementById("login-form").onsubmit = async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      try {
        const response = await api("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
        const result = await response.json();
        if (!response.ok) return showMessage(result.message);
        location.href = "/dashboard.html";
      } catch { showMessage("Unable to connect to the server."); }
    };
  } else if (mode === "forgot") {
    content.innerHTML = `
      <h2>Reset Password</h2>
      <form id="forgot-form"><label>Registered Email Address</label>
        <input name="email" type="email" autocomplete="email" required>
        <button class="btn btn-primary">Send Reset Link</button></form>
      <p class="switch" onclick="showAuth('login')">Back to login</p>`;
    document.getElementById("forgot-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        const response = await api("/api/auth/password/forgot", {
          method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target)))
        });
        const result = await response.json();
        showMessage(result.message);
      } catch { showMessage("Unable to connect to the server."); }
    };
  }
}

function showOtp(phone) {
  content.innerHTML = `
    <h2>Verify Phone Number</h2><p>Enter the six-digit verification code.</p>
    <button class="btn btn-outline" id="request-otp">Request Code</button>
    <form id="otp-form"><label>Verification Code</label>
      <input name="code" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" required>
      <button class="btn btn-primary">Verify Phone</button></form>`;
  document.getElementById("request-otp").onclick = async () => {
    try {
      const response = await api("/api/otp/request", { method: "POST", body: JSON.stringify({ phone }) });
      const result = await response.json();
      showMessage(result.developmentCode ? `Development OTP: ${result.developmentCode}` : result.message);
    } catch { showMessage("Unable to request verification code."); }
  };
  document.getElementById("otp-form").onsubmit = async (event) => {
    event.preventDefault();
    const code = new FormData(event.target).get("code");
    try {
      const response = await api("/api/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
      const result = await response.json();
      showMessage(result.message);
      if (response.ok) setTimeout(() => showAuth("login"), 1200);
    } catch { showMessage("Unable to verify your phone."); }
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await api("/api/predictions");
    if (!response.ok) return;
    const result = await response.json();
    const list = document.getElementById("prediction-list");
    if (result.predictions?.length) {
      list.innerHTML = result.predictions.map(item => `
        <article class="score-card"><small>${escapeHTML(item.sport || "SPORT")}</small>
          <h3>${escapeHTML(item.event_name)}</h3><p>${escapeHTML(item.prediction)}</p>
          <p>Odds: ${escapeHTML(String(item.odds ?? "N/A"))}</p></article>`).join("");
    }
  } catch { /* Public predictions API is added in the next backend stage. */ }
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
