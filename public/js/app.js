
const overlay = document.getElementById("auth-overlay");
const content = document.getElementById("auth-content");
const message = document.getElementById("auth-message");

function showMessage(text) {
  message.textContent = text;
}

function closeAuth() {
  overlay.hidden = true;
}

function showAuth(mode) {
  overlay.hidden = false;
  message.textContent = "";

  if (mode === "register") {
    content.innerHTML = `
      <h2>Create Account</h2>
      <form id="register-form">
        <label>Full Name</label>
        <input name="full_name" required maxlength="120">
        <label>Country</label>
        <select name="country" required>
          <option value="">Select Country</option>
          <option>Ghana</option>
          <option>Nigeria</option>
          <option>Kenya</option>
          <option>Uganda</option>
          <option>South Africa</option>
          <option>Cameroon</option>
        </select>
        <label>Phone Number (include country code)</label>
        <input name="phone" placeholder="+233..." required>
        <label>Password</label>
        <input name="password" type="password" minlength="10" required>
        <label>Confirm Password</label>
        <input name="confirmPassword" type="password" required>
        <button class="btn btn-primary">Create Account</button>
      </form>
      <p class="switch" onclick="showAuth('login')">Already registered? Login</p>
    `;

    document.getElementById("register-form").onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok) return showMessage(result.message);

        showOtp(data.phone);
      } catch {
        showMessage("Unable to connect to the server.");
      }
    };
  } else if (mode === "login") {
    content.innerHTML = `
      <h2>Welcome Back</h2>
      <form id="login-form">
        <label>Phone Number</label>
        <input name="phone" required>
        <label>Password</label>
        <input name="password" type="password" required>
        <button class="btn btn-primary">Login</button>
      </form>
      <p class="switch" onclick="showAuth('register')">Create an account</p>
    `;

    document.getElementById("login-form").onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok) return showMessage(result.message);

        location.href = "/dashboard.html";
      } catch {
        showMessage("Unable to connect to the server.");
      }
    };
  }
}

function showOtp(phone) {
  content.innerHTML = `
    <h2>Verify Phone Number</h2>
    <p>Enter the six-digit verification code.</p>
    <button class="btn btn-outline" id="request-otp">Request Code</button>
    <form id="otp-form">
      <label>Verification Code</label>
      <input name="code" maxlength="6" inputmode="numeric" required>
      <button class="btn btn-primary">Verify Phone</button>
    </form>
  `;

  document.getElementById("request-otp").onclick = async () => {
    try {
      const response = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });

      const result = await response.json();
      showMessage(result.developmentCode
        ? `Development OTP: ${result.developmentCode}`
        : result.message);
    } catch {
      showMessage("Unable to request verification code.");
    }
  };

  document.getElementById("otp-form").onsubmit = async (e) => {
    e.preventDefault();

    const code = new FormData(e.target).get("code");

    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code })
      });

      const result = await response.json();
      showMessage(result.message);

      if (response.ok) {
        setTimeout(() => showAuth("login"), 1200);
      }
    } catch {
      showMessage("Unable to verify your phone.");
    }
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/predictions");
    if (!response.ok) return;

    const result = await response.json();
    const list = document.getElementById("prediction-list");

    if (result.predictions?.length) {
      list.innerHTML = result.predictions.map(item => `
        <article class="score-card">
          <small>${escapeHTML(item.sport || "SPORT")}</small>
          <h3>${escapeHTML(item.event_name)}</h3>
          <p>${escapeHTML(item.prediction)}</p>
          <p>Odds: ${escapeHTML(String(item.odds ?? "N/A"))}</p>
        </article>
      `).join("");
    }
  } catch {
    // Predictions API will be connected in the next development stage.
  }
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}
