
/* =========================================
   EOMYSTERY — MAIN APP
   A little mystery for EOM lovers.
========================================= */

(() => {
  "use strict";

  // ========================================
  // 1. SUPABASE CONFIGURATION
  // ========================================

  const config = window.EOMYSTERY_CONFIG;

  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    alert("Không tìm thấy cấu hình Supabase. Vui lòng kiểm tra config.js.");
    return;
  }

  if (!window.supabase) {
    alert("Không thể tải Supabase. Vui lòng tải lại trang.");
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  const ORDERS_FUNCTION = "eomystery-orders";
  const CART_STORAGE_KEY = "eomystery_cart_v1";

  // ========================================
  // 2. ELEMENTS
  // ========================================

  const $ = (id) => document.getElementById(id);

  const loginBtn = $("loginBtn");
  const registerBtn = $("registerBtn");
  const cartBtn = $("cartBtn");
  const accountBtn = $("accountBtn");
  const logoutBtn = $("logoutBtn");

  const authSection = $("authSection");
  const closeAuthBtn = $("closeAuthBtn");
  const authForm = $("authForm");
  const authTitle = $("authTitle");
  const authDescription = $("authDescription");
  const authSubmitBtn = $("authSubmitBtn");
  const authSwitchText = $("authSwitchText");
  const authSwitchBtn = $("authSwitchBtn");
  const authMessage = $("authMessage");

  const nameField = $("nameField");
  const fullNameInput = $("fullName");
  const phoneInput = $("phone");
  const passwordInput = $("password");
  const confirmPasswordField = $("confirmPasswordField");
  const confirmPasswordInput = $("confirmPassword");

  const productList = $("productList");

  const cartSection = $("cartSection");
  const closeCartBtn = $("closeCartBtn");
  const cartItems = $("cartItems");
  const cartTotal = $("cartTotal");
  const cartCount = $("cartCount");
  const checkoutBtn = $("checkoutBtn");

  // ========================================
  // 3. STATE
  // ========================================

  let authMode = "login";
  let currentUser = null;
  let currentProfile = null;
  let products = [];
  let cart = loadCart();
  let checkoutBusy = false;
  let currentBillFile = null;
  let paymentQR = "";

  // ========================================
  // 4. HELPERS
  // ========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function normalizeUnicode(value) {
    return String(value ?? "").normalize("NFC");
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";
  }

  function normalizePhone(value) {
    let phone = String(value || "").trim().replace(/[^\d+]/g, "");

    if (phone.startsWith("0084")) {
      phone = "+84" + phone.slice(4);
    } else if (phone.startsWith("84")) {
      phone = "+" + phone.slice(2);
    } else if (phone.startsWith("0")) {
      phone = "+84" + phone.slice(1);
    }

    return phone;
  }

  function showMessage(message, type = "error") {
    if (!authMessage) return;

    authMessage.textContent = normalizeUnicode(message);
    authMessage.style.color =
      type === "success" ? "#47845d" : "#bd536f";
  }

  function setLoading(loading, text = "") {
    if (!authSubmitBtn) return;

    authSubmitBtn.disabled = loading;

    if (loading) {
      authSubmitBtn.dataset.originalText = authSubmitBtn.textContent;
      authSubmitBtn.textContent = text || "Đang xử lý...";
    } else {
      authSubmitBtn.textContent =
        authSubmitBtn.dataset.originalText ||
        (authMode === "login" ? "Đăng nhập" : "Đăng ký");
    }
  }

  function showNotice(message) {
    window.alert(normalizeUnicode(message));
  }

  function getCartTotal() {
    return cart.reduce((sum, item) => {
      const product = products.find(
        p => String(p.id) === String(item.id)
      );

      return sum + (product
        ? Number(product.price) * Number(item.quantity)
        : 0);
    }, 0);
  }

  function getCartItemsForOrder() {
    return cart.map(item => ({
      product_id: item.id,
      id: item.id,
      quantity: Number(item.quantity)
    }));
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);
    authSection?.classList.remove("hidden");
  }

  function closeAuth() {
    authSection?.classList.add("hidden");
    authForm?.reset();
    showMessage("");
  }

  function openCart() {
    cartSection?.classList.remove("hidden");
    renderCart();
  }

  function closeCart() {
    cartSection?.classList.add("hidden");
  }

  // ========================================
  // 5. DYNAMIC EMAIL FIELD
  // ========================================

  function createEmailField() {
    let emailField = $("emailField");

    if (emailField) return emailField;

    emailField = document.createElement("div");
    emailField.id = "emailField";
    emailField.className = "form-field hidden";

    emailField.innerHTML = `
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        autocomplete="email"
        placeholder="Nhập địa chỉ email"
      >
    `;

    if (nameField?.parentNode) {
      nameField.parentNode.insertBefore(
        emailField,
        nameField.nextSibling
      );
    }

    return emailField;
  }

  // ========================================
  // 6. AUTH INTERFACE
  // ========================================

  function setAuthMode(mode) {
    authMode = mode === "register" ? "register" : "login";

    const isRegister = authMode === "register";

    if (authTitle) {
      authTitle.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
    }

    if (authDescription) {
      authDescription.textContent = isRegister
        ? "Tạo tài khoản để trở thành một phần của EOMYSTERY."
        : "Đăng nhập để tiếp tục hành trình mua sắm.";
    }

    nameField?.classList.toggle("hidden", !isRegister);
    confirmPasswordField?.classList.toggle("hidden", !isRegister);

    const emailField = createEmailField();
    emailField.classList.toggle("hidden", !isRegister);

    if (fullNameInput) fullNameInput.required = isRegister;
    if (confirmPasswordInput) confirmPasswordInput.required = isRegister;

    const emailInput = $("email");
    if (emailInput) emailInput.required = isRegister;

    if (passwordInput) {
      passwordInput.autocomplete = isRegister
        ? "new-password"
        : "current-password";
    }

    if (authSubmitBtn) {
      authSubmitBtn.textContent = isRegister
        ? "Tạo tài khoản"
        : "Đăng nhập";
    }

    if (authSwitchText) {
      authSwitchText.textContent = isRegister
        ? "Đã có tài khoản?"
        : "Chưa có tài khoản?";
    }

    if (authSwitchBtn) {
      authSwitchBtn.textContent = isRegister
        ? "Đăng nhập"
        : "Đăng ký";
    }

    showMessage("");
  }

  // ========================================
  // 7. REGISTER
  // ========================================

  async function registerCustomer() {
    const fullName = normalizeUnicode(fullNameInput?.value.trim());
    const phone = normalizePhone(phoneInput?.value);
    const email = $("email")?.value.trim().toLowerCase();
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    if (!fullName || !phone || !email || !password) {
      showMessage("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    if (!/^\+84\d{9,10}$/.test(phone)) {
      showMessage("Số điện thoại chưa đúng. Vui lòng nhập số điện thoại Việt Nam hợp lệ.");
      return;
    }

    if (password.length < 8) {
      showMessage("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true, "Đang tạo tài khoản...");

    try {
      const { data, error } = await db.functions.invoke(
        "register-customer",
        {
          body: {
            full_name: fullName,
            phone,
            email,
            password
          }
        }
      );

      if (error) {
        let detail = "";

        if (error.context instanceof Response) {
          try {
            detail = (await error.context.clone().json())?.message || "";
          } catch {}
        }

        throw new Error(detail || data?.message || error.message);
      }

      if (!data?.success) {
        throw new Error(data?.message || "Không thể tạo tài khoản.");
      }

      authForm?.reset();

      showMessage(
        "Đăng ký thành công! Hãy kiểm tra email để xác minh tài khoản, kể cả mục Spam nhé.",
        "success"
      );
    } catch (error) {
      console.error("Register error:", error);

      let message = error.message || "Đăng ký thất bại.";
      const lower = message.toLowerCase();

      if (
        lower.includes("duplicate") ||
        lower.includes("unique") ||
        lower.includes("already registered") ||
        lower.includes("already exists")
      ) {
        message = "Email hoặc số điện thoại này đã được sử dụng.";
      }

      showMessage(message);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // 8. LOGIN
  // ========================================

  async function loginCustomer() {
    const phone = normalizePhone(phoneInput?.value);
    const password = passwordInput?.value;

    if (!phone || !password) {
      showMessage("Vui lòng nhập số điện thoại và mật khẩu.");
      return;
    }

    setLoading(true, "Đang đăng nhập...");

    try {
      const { data, error } = await db.functions.invoke(
        "login-with-phone",
        {
          body: { phone, password }
        }
      );

      if (error) throw error;

      if (!data?.access_token || !data?.refresh_token) {
        throw new Error("Không nhận được phiên đăng nhập.");
      }

      const { error: sessionError } = await db.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      if (sessionError) throw sessionError;

      authForm?.reset();
      closeAuth();

      await loadCurrentProfile();

      showNotice("Đăng nhập thành công. Chào mừng bạn đến với EOMYSTERY!");
    } catch (error) {
      console.error("Login error:", error);
      showMessage(
        "Đăng nhập chưa thành công. Hãy kiểm tra số điện thoại, mật khẩu hoặc thử lại sau."
      );
    } finally {
      setLoading(false);
    }
  }

  authForm?.addEventListener("submit", async event => {
    event.preventDefault();

    if (authMode === "register") {
      await registerCustomer();
    } else {
      await loginCustomer();
    }
  });

  // ========================================
  // 9. CURRENT PROFILE
  // ========================================

  async function loadCurrentProfile() {
    const {
      data: { user },
      error: userError
    } = await db.auth.getUser();

    if (userError || !user) {
      currentUser = null;
      currentProfile = null;
      updateHeader();
      return;
    }

    currentUser = user;

    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) console.error("Profile error:", error);

    currentProfile = data || null;
    updateHeader();
  }

  function updateHeader() {
    const loggedIn = Boolean(currentUser);

    loginBtn?.classList.toggle("hidden", loggedIn);
    registerBtn?.classList.toggle("hidden", loggedIn);
    accountBtn?.classList.toggle("hidden", !loggedIn);
    logoutBtn?.classList.toggle("hidden", !loggedIn);

    if (accountBtn && loggedIn) {
      accountBtn.textContent = currentProfile?.full_name || "Tài khoản";
      accountBtn.title = "Tài khoản của bạn";
    }
  }

  // ========================================
  // 10. LOGOUT
  // ========================================

  async function logoutCustomer() {
    if (!window.confirm("Bạn có chắc muốn đăng xuất khỏi EOMYSTERY không?")) {
      return;
    }

    const { error } = await db.auth.signOut();

    if (error) {
      showNotice("Đăng xuất chưa thành công. Vui lòng thử lại.");
      return;
    }

    currentUser = null;
    currentProfile = null;
    updateHeader();

    showNotice("Bạn đã đăng xuất khỏi EOMYSTERY.");
  }

  // ========================================
  // 11. PRODUCTS
  // ========================================

  async function loadProducts() {
    if (!productList) return;

    productList.innerHTML = `
      <div class="empty-state">Đang tải sản phẩm...</div>
    `;

    const { data, error } = await db
      .from("products")
      .select("id, name, description, price, image_url, stock, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Products error:", error);

      productList.innerHTML = `
        <div class="empty-state">
          Chưa thể tải sản phẩm. Vui lòng thử tải lại trang nhé.
        </div>
      `;
      return;
    }

    products = data || [];
    renderProducts();
  }

  function renderProducts() {
    if (!productList) return;

    if (!products.length) {
      productList.innerHTML = `
        <div class="empty-state">Sản phẩm sẽ được cập nhật sớm ♡</div>
      `;
      return;
    }

    productList.innerHTML = products.map(product => {
      const outOfStock = Number(product.stock) <= 0;

      const image = product.image_url
        ? `<img src="${escapeHTML(product.image_url)}"
                alt="${escapeHTML(product.name)}" loading="lazy">`
        : `<div class="product-no-image">EOMYSTERY ♡</div>`;

      return `
        <article class="product-card ${outOfStock ? "out-of-stock" : ""}">
          <div class="product-image">
            ${image}
            ${outOfStock ? '<span class="stock-overlay">HẾT HÀNG</span>' : ""}
          </div>

          <div class="product-info">
            <h3>${escapeHTML(normalizeUnicode(product.name))}</h3>
            <p class="product-description">
              ${escapeHTML(normalizeUnicode(product.description || ""))}
            </p>
            <p class="product-price">${formatMoney(product.price)}</p>
            <p class="product-stock">
              ${outOfStock ? "Tạm hết hàng" : `Còn ${Number(product.stock)} sản phẩm`}
            </p>
            <button
              class="pink-button product-add-button"
              data-add-product="${escapeHTML(product.id)}"
              ${outOfStock ? "disabled" : ""}
            >
              ${outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  // ========================================
  // 12. CART
  // ========================================

  function loadCart() {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  function addToCart(productId) {
    const product = products.find(p => String(p.id) === String(productId));

    if (!product) return;

    if (Number(product.stock) <= 0) {
      showNotice("Sản phẩm hiện đã hết hàng.");
      return;
    }

    const existing = cart.find(item => String(item.id) === String(productId));

    if (existing) {
      if (existing.quantity >= Number(product.stock)) {
        showNotice("Số lượng trong giỏ đã đạt giới hạn tồn kho.");
        return;
      }

      existing.quantity += 1;
    } else {
      cart.push({ id: product.id, quantity: 1 });
    }

    saveCart();
    renderCart();
    showNotice("Đã thêm sản phẩm vào giỏ hàng ♡");
  }

  function updateCartQuantity(productId, quantity) {
    const product = products.find(p => String(p.id) === String(productId));
    const item = cart.find(entry => String(entry.id) === String(productId));

    if (!item || !product) return;

    const newQuantity = Number(quantity);

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > Number(product.stock)) {
      showNotice("Số lượng vượt quá tồn kho hiện tại.");
      return;
    }

    item.quantity = newQuantity;
    saveCart();
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter(item => String(item.id) !== String(productId));
    saveCart();
    renderCart();
  }

  function renderCart() {
    if (!cartItems) return;

    let total = 0;
    let totalQuantity = 0;

    const validItems = cart.map(item => {
      const product = products.find(p => String(p.id) === String(item.id));

      if (!product || Number(product.stock) <= 0) return null;

      const quantity = Math.min(
        Math.max(1, Number(item.quantity) || 1),
        Number(product.stock)
      );

      return { product, quantity };
    }).filter(Boolean);

    cart = validItems.map(({ product, quantity }) => ({
      id: product.id,
      quantity
    }));

    saveCart();

    if (!validItems.length) {
      cartItems.innerHTML = `
        <div class="empty-state">Giỏ hàng của bạn đang trống ♡</div>
      `;
    } else {
      cartItems.innerHTML = validItems.map(({ product, quantity }) => {
        const subtotal = Number(product.price) * quantity;

        total += subtotal;
        totalQuantity += quantity;

        return `
          <div class="cart-item">
            <div class="cart-item-info">
              <strong>${escapeHTML(product.name)}</strong>
              <p>${formatMoney(product.price)}</p>
            </div>

            <div class="cart-item-actions">
              <button type="button" data-cart-action="decrease"
                data-product-id="${escapeHTML(product.id)}">−</button>
              <span>${quantity}</span>
              <button type="button" data-cart-action="increase"
                data-product-id="${escapeHTML(product.id)}">+</button>
              <button type="button" class="cart-remove"
                data-cart-action="remove"
                data-product-id="${escapeHTML(product.id)}">Xóa</button>
            </div>

            <strong class="cart-subtotal">${formatMoney(subtotal)}</strong>
          </div>
        `;
      }).join("");
    }

    if (cartTotal) cartTotal.textContent = formatMoney(total);
    if (cartCount) cartCount.textContent = String(totalQuantity);
    if (checkoutBtn) checkoutBtn.disabled = validItems.length === 0;
  }

  // ========================================
  // 13. CHECKOUT UI
  // ========================================

  function addCheckoutStyles() {
    if ($("eomCheckoutStyles")) return;

    const style = document.createElement("style");
    style.id = "eomCheckoutStyles";

    style.textContent = `
      .eom-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(55, 38, 46, .48);
        overflow-y: auto;
      }

      .eom-modal.hidden { display: none !important; }

      .eom-checkout-card {
        width: min(100%, 620px);
        max-height: 92vh;
        overflow-y: auto;
        background: #fffaf7;
        border: 1px solid #f0e4e9;
        border-radius: 20px;
        padding: 24px;
        color: #51434a;
        box-shadow: 0 18px 55px rgba(70, 40, 55, .18);
      }

      .eom-checkout-card h2 {
        margin: 0 0 8px;
        text-align: center;
        color: #bd7895;
        font-size: 24px;
      }

      .eom-checkout-subtitle {
        text-align: center;
        color: #95868d;
        font-size: 13px;
        margin-bottom: 20px;
      }

      .eom-checkout-card label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        margin: 13px 0 6px;
      }

      .eom-checkout-card input,
      .eom-checkout-card textarea {
        box-sizing: border-box;
        width: 100%;
        border: 1px solid #eadce2;
        border-radius: 10px;
        padding: 11px 12px;
        background: white;
        color: #51434a;
        font: inherit;
        outline: none;
      }

      .eom-checkout-card input:focus,
      .eom-checkout-card textarea:focus {
        border-color: #d69ab4;
      }

      .eom-checkout-card textarea {
        min-height: 75px;
        resize: vertical;
      }

      .eom-checkout-summary {
        background: #fff1f6;
        padding: 14px;
        border-radius: 12px;
        margin: 16px 0;
      }

      .eom-checkout-summary-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 0;
        font-size: 14px;
      }

      .eom-checkout-total {
        border-top: 1px solid #ebd7e0;
        margin-top: 8px;
        padding-top: 10px;
        color: #bd7895;
        font-weight: 700;
        font-size: 17px;
      }

      .eom-qr-wrap {
        text-align: center;
        border: 1px dashed #e6c6d4;
        border-radius: 14px;
        padding: 14px;
        background: white;
        margin: 14px 0;
      }

      .eom-qr-wrap img {
        display: block;
        width: min(100%, 260px);
        max-height: 300px;
        object-fit: contain;
        margin: 10px auto;
      }

      .eom-qr-placeholder {
        color: #95868d;
        padding: 25px 8px;
        font-size: 13px;
      }

      .eom-checkout-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }

      .eom-checkout-actions button {
        flex: 1;
        border: 0;
        border-radius: 30px;
        padding: 12px;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
      }

      .eom-primary {
        background: #d99eb8;
        color: white;
      }

      .eom-secondary {
        background: #f4e8ed;
        color: #765b68;
      }

      .eom-checkout-actions button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .eom-file-name {
        color: #648c70;
        font-size: 12px;
        margin-top: 7px;
        overflow-wrap: anywhere;
      }

      .eom-section-title {
        font-weight: 700;
        color: #bd7895;
        margin-top: 18px;
      }

      .eom-order-card {
        border: 1px solid #f0e4e9;
        background: white;
        border-radius: 13px;
        padding: 14px;
        margin: 12px 0;
      }

      .eom-order-top {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 13px;
      }

      .eom-order-status {
        display: inline-block;
        background: #fff1f6;
        color: #a86683;
        border-radius: 20px;
        padding: 5px 10px;
        font-size: 12px;
        margin: 10px 0;
      }

      .eom-order-lines {
        font-size: 13px;
        color: #786871;
        line-height: 1.7;
        white-space: pre-line;
      }

      .eom-received-btn {
        margin-top: 12px;
        border: 0;
        border-radius: 20px;
        padding: 9px 14px;
        background: #648c70;
        color: white;
        cursor: pointer;
      }

      .eom-muted {
        color: #95868d;
        font-size: 12px;
      }

      @media (max-width: 480px) {
        .eom-checkout-card { padding: 18px; }
        .eom-checkout-actions { flex-direction: column; }
      }
    `;

    document.head.appendChild(style);
  }

  function createCheckoutModal() {
    if ($("eomCheckoutModal")) return;

    addCheckoutStyles();

    const modal = document.createElement("div");
    modal.id = "eomCheckoutModal";
    modal.className = "eom-modal hidden";

    modal.innerHTML = `
      <div class="eom-checkout-card">
        <h2>Complete your order ♡</h2>
        <p class="eom-checkout-subtitle">
          Một chút yêu thương sẽ được gửi đến bạn từ EOMYSTERY.
        </p>

        <form id="eomCheckoutForm">
          <label for="eomReceiver">Tên người nhận *</label>
          <input id="eomReceiver" required autocomplete="name"
            placeholder="Nhập tên người nhận">

          <label for="eomPhone">Số điện thoại *</label>
          <input id="eomPhone" required inputmode="tel"
            placeholder="Nhập số điện thoại">

          <label for="eomAddress">Địa chỉ nhận hàng *</label>
          <textarea id="eomAddress" required
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố (trước khi sáp nhập tỉnh/thành)"></textarea>

          <label for="eomSocial">Facebook / Threads</label>
          <input id="eomSocial" placeholder="Link Facebook hoặc Threads (không bắt buộc)">

          <label for="eomNote">Ghi chú đơn hàng</label>
          <textarea id="eomNote" placeholder="Ghi chú thêm nếu có"></textarea>

          <div class="eom-checkout-summary">
            <div id="eomCheckoutProducts"></div>
            <div class="eom-checkout-summary-row eom-checkout-total">
              <span>Tổng thanh toán</span>
              <strong id="eomCheckoutTotal">0đ</strong>
            </div>
          </div>

          <div class="eom-section-title">01. Quét mã QR để thanh toán</div>
          <div class="eom-qr-wrap" id="eomQRWrap">
            <div class="eom-qr-placeholder">Đang tải mã QR thanh toán...</div>
          </div>

          <div class="eom-section-title">02. Tải ảnh bill chuyển khoản</div>
          <label for="eomBill">Ảnh xác nhận chuyển khoản *</label>
          <input id="eomBill" type="file" accept="image/jpeg,image/png,image/webp" required>
          <div id="eomBillName" class="eom-file-name"></div>

          <p class="eom-muted">
            Vui lòng kiểm tra số tiền và tải ảnh giao dịch thành công trước khi gửi đơn.
          </p>

          <div id="eomCheckoutMessage" role="status"
            style="font-size:13px;margin-top:12px;color:#bd536f"></div>

          <div class="eom-checkout-actions">
            <button type="button" class="eom-secondary" id="eomCheckoutCancel">
              Quay lại
            </button>
            <button type="submit" class="eom-primary" id="eomPlaceOrder">
              Gửi đơn hàng
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    $("eomCheckoutCancel").addEventListener("click", closeCheckout);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeCheckout();
    });

    $("eomBill").addEventListener("change", handleBillSelection);
    $("eomCheckoutForm").addEventListener("submit", submitOrder);
  }

  function openCheckout() {
    if (!currentUser) {
      closeCart();
      openAuth("login");
      showMessage("Vui lòng đăng nhập trước khi đặt hàng.");
      return;
    }

    if (!cart.length) {
      showNotice("Giỏ hàng đang trống.");
      return;
    }

    createCheckoutModal();

    $("eomReceiver").value =
      currentProfile?.full_name || currentUser.user_metadata?.full_name || "";

    $("eomPhone").value = currentProfile?.phone || "";

    $("eomCheckoutProducts").innerHTML = cart.map(item => {
      const product = products.find(p => String(p.id) === String(item.id));
      if (!product) return "";

      return `
        <div class="eom-checkout-summary-row">
          <span>${escapeHTML(product.name)} × ${item.quantity}</span>
          <strong>${formatMoney(Number(product.price) * item.quantity)}</strong>
        </div>
      `;
    }).join("");

    $("eomCheckoutTotal").textContent = formatMoney(getCartTotal());
    $("eomCheckoutMessage").textContent = "";

    currentBillFile = null;
    $("eomBill").value = "";
    $("eomBillName").textContent = "";

    $("eomCheckoutModal").classList.remove("hidden");
    closeCart();

    loadPaymentQR();
  }

  function closeCheckout() {
    if (checkoutBusy) return;
    $("eomCheckoutModal")?.classList.add("hidden");
  }

  // ========================================
  // 14. PAYMENT QR
  // ========================================

  async function loadPaymentQR() {
    const wrap = $("eomQRWrap");
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="eom-qr-placeholder">Đang tải mã QR thanh toán...</div>
    `;

    const { data, error } = await db
      .from("payment_settings")
      .select("qr_image_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Payment QR error:", error);
      wrap.innerHTML = `
        <div class="eom-qr-placeholder">
          Chưa thể tải mã QR. Vui lòng thử tải lại trang.
        </div>
      `;
      return;
    }

    paymentQR = data?.qr_image_url || "";

    if (!paymentQR) {
      wrap.innerHTML = `
        <div class="eom-qr-placeholder">
          EOMYSTERY chưa cập nhật mã QR thanh toán.
          Vui lòng liên hệ cửa hàng.
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <img src="${escapeHTML(paymentQR)}" alt="Mã QR thanh toán EOMYSTERY">
      <div class="eom-muted">
        Tổng tiền cần thanh toán: <strong>${formatMoney(getCartTotal())}</strong>
      </div>
    `;
  }

  // ========================================
  // 15. PAYMENT BILL
  // ========================================

  function handleBillSelection(event) {
    const file = event.target.files?.[0];
    const message = $("eomCheckoutMessage");

    currentBillFile = null;
    $("eomBillName").textContent = "";

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      message.textContent = "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.";
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      message.textContent = "Ảnh bill không được vượt quá 8 MB.";
      event.target.value = "";
      return;
    }

    currentBillFile = file;
    message.textContent = "";
    $("eomBillName").textContent = "Đã chọn: " + file.name;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",")
          ? result.split(",")[1]
          : result;

        resolve(base64);
      };

      reader.onerror = () => reject(new Error("Không thể đọc ảnh bill."));
      reader.readAsDataURL(file);
    });
  }

  // ========================================
  // 16. CALL ORDER EDGE FUNCTION
  // ========================================

  async function callOrdersFunction(payload) {
    const {
      data: { session },
      error: sessionError
    } = await db.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const { data, error } = await db.functions.invoke(
      ORDERS_FUNCTION,
      {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (error) {
      console.error("Order function error:", error);

      let detail = "";

      if (error.context instanceof Response) {
        try {
          const response = await error.context.clone().json();
          detail = response?.message || "";
        } catch {}
      }

      throw new Error(detail || error.message || "Không thể kết nối hệ thống đơn hàng.");
    }

    if (!data?.success) {
      throw new Error(data?.message || "Yêu cầu chưa được xử lý thành công.");
    }

    return data;
  }

  // ========================================
  // 17. SUBMIT ORDER
  // ========================================

  async function submitOrder(event) {
    event.preventDefault();

    if (checkoutBusy) return;

    const receiver = $("eomReceiver").value.trim();
    const phone = normalizePhone($("eomPhone").value);
    const address = $("eomAddress").value.trim();
    const social = $("eomSocial").value.trim();
    const note = $("eomNote").value.trim();
    const message = $("eomCheckoutMessage");
    const submitButton = $("eomPlaceOrder");

    if (!receiver || !phone || !address) {
      message.textContent = "Vui lòng điền đầy đủ tên, số điện thoại và địa chỉ nhận hàng.";
      return;
    }

    if (!/^(\+84\d{9,10})$/.test(phone)) {
      message.textContent = "Số điện thoại nhận hàng chưa hợp lệ.";
      return;
    }

    if (!currentBillFile) {
      message.textContent = "Vui lòng tải ảnh bill chuyển khoản.";
      return;
    }

    if (!cart.length) {
      message.textContent = "Giỏ hàng đang trống.";
      return;
    }

    if (!paymentQR) {
      message.textContent = "Chưa có mã QR thanh toán. Vui lòng liên hệ cửa hàng.";
      return;
    }

    checkoutBusy = true;
    submitButton.disabled = true;
    submitButton.textContent = "Đang gửi đơn...";

    try {
      const billBase64 = await fileToBase64(currentBillFile);

      const payload = {
        action: "create_order",

        // Thông tin người nhận
        customer_name: receiver,
        full_name: receiver,
        phone,
        shipping_address: address,
        address,

        // Thông tin bổ sung
        facebook_threads: social,
        social,
        order_note: note,
        note,

        // Sản phẩm
        items: getCartItemsForOrder(),

        // Ảnh bill
        bill_base64: billBase64,
        bill_mime_type: currentBillFile.type,
        bill_mime: currentBillFile.type,
        bill_file_name: currentBillFile.name
      };

      const result = await callOrdersFunction(payload);

      const orderId =
        result.order_id ||
        result.orderId ||
        result.data?.order_id ||
        "";

      cart = [];
      saveCart();
      renderCart();

      $("eomCheckoutModal").classList.add("hidden");

      showNotice(
        "EOMYSTERY đã nhận được yêu cầu đặt hàng của bạn ♡\n\n" +
        (orderId ? `Mã đơn hàng: ${orderId}\n\n` : "") +
        "Cảm ơn bạn đã tin tưởng và ủng hộ EOMYSTERY!"
      );

      await loadOrderHistory();
    } catch (error) {
      console.error("Create order error:", error);

      message.textContent =
        error.message || "Không thể gửi đơn hàng. Vui lòng thử lại.";

      window.alert(
        "Đặt hàng chưa thành công:\n" +
        (error.message || "Vui lòng thử lại sau.")
      );
    } finally {
      checkoutBusy = false;
      submitButton.disabled = false;
      submitButton.textContent = "Gửi đơn hàng";
    }
  }

  // ========================================
  // 18. ORDER HISTORY
  // ========================================

  function createOrderHistoryModal() {
    if ($("eomOrderHistoryModal")) return;

    addCheckoutStyles();

    const modal = document.createElement("div");
    modal.id = "eomOrderHistoryModal";
    modal.className = "eom-modal hidden";

    modal.innerHTML = `
      <div class="eom-checkout-card">
        <h2>My orders ♡</h2>
        <p class="eom-checkout-subtitle">
          Những đơn hàng của bạn tại EOMYSTERY.
        </p>

        <div id="eomOrderHistoryContent">
          <div class="eom-muted">Đang tải đơn hàng...</div>
        </div>

        <div class="eom-checkout-actions">
          <button type="button" class="eom-secondary" id="eomOrderHistoryClose">
            Đóng
          </button>
          <button type="button" class="eom-primary" id="eomOrderHistoryRefresh">
            Làm mới
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    $("eomOrderHistoryClose").addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    $("eomOrderHistoryRefresh").addEventListener("click", loadOrderHistory);

    modal.addEventListener("click", event => {
      if (event.target === modal) modal.classList.add("hidden");
    });

    $("eomOrderHistoryContent").addEventListener("click", async event => {
      const button = event.target.closest("[data-confirm-received]");
      if (!button) return;

      const orderId = button.dataset.confirmReceived;

      if (!window.confirm("Bạn xác nhận đã nhận được đơn hàng này?")) {
        return;
      }

      button.disabled = true;
      button.textContent = "Đang cập nhật...";

      try {
        await callOrdersFunction({
          action: "confirm_received",
          order_id: orderId
        });

        showNotice("Cảm ơn bạn đã xác nhận nhận hàng thành công ♡");
        await loadOrderHistory();
      } catch (error) {
        console.error("Confirm received error:", error);
        showNotice(error.message || "Không thể cập nhật trạng thái đơn hàng.");
        button.disabled = false;
        button.textContent = "Đã nhận được hàng";
      }
    });
  }

  function getOrderValue(order, keys, fallback = "") {
    for (const key of keys) {
      if (order?.[key] !== undefined && order?.[key] !== null) {
        return order[key];
      }
    }

    return fallback;
  }

  function renderOrderHistory(orders) {
    const content = $("eomOrderHistoryContent");
    if (!content) return;

    if (!Array.isArray(orders) || !orders.length) {
      content.innerHTML = `
        <div class="eom-muted" style="text-align:center;padding:25px 5px">
          Bạn chưa có đơn hàng nào tại EOMYSTERY.
        </div>
      `;
      return;
    }

    content.innerHTML = orders.map(order => {
      const orderId = getOrderValue(order, ["order_id", "ORDER ID", "orderId"]);
      const orderDate = getOrderValue(order, ["order_date", "ORDER DATE", "created_at"]);
      const status = getOrderValue(order, ["order_status", "ORDER STATUS", "status"], "Đang xử lý");
      const total = getOrderValue(order, ["total_amount", "TOTAL AMOUNT", "total"], 0);
      const details = getOrderValue(order, ["product_details", "PRODUCT DETAILS", "items"], "");
      const tracking = getOrderValue(order, ["tracking_number", "TRACKING NUMBER"], "");
      const carrier = getOrderValue(order, ["shipping_carrier", "SHIPPING CARRIER"], "");
      const received = getOrderValue(order, ["customer_received", "CUSTOMER RECEIVED"], false);

      const detailText = Array.isArray(details)
        ? details.map(item => {
            const name = item.name || item.product_name || item.product_id || "Sản phẩm";
            return `${name} × ${item.quantity || 1}`;
          }).join("\n")
        : String(details || "");

      const canConfirm =
        String(status).toLowerCase().includes("vận chuyển") ||
        String(status).toLowerCase().includes("shipping") ||
        Boolean(tracking);

      return `
        <div class="eom-order-card">
          <div class="eom-order-top">
            <strong>${escapeHTML(orderId || "Đơn hàng")}</strong>
            <span class="eom-muted">${escapeHTML(orderDate)}</span>
          </div>

          <div class="eom-order-status">${escapeHTML(status)}</div>

          <div class="eom-order-lines">
            ${escapeHTML(detailText)}
          </div>

          ${carrier || tracking ? `
            <p class="eom-muted">
              Đơn vị vận chuyển: ${escapeHTML(carrier)}<br>
              Mã vận đơn: ${escapeHTML(tracking)}
            </p>
          ` : ""}

          <div class="eom-order-top" style="margin-top:10px">
            <strong>Tổng tiền</strong>
            <strong>${formatMoney(total)}</strong>
          </div>

          ${canConfirm && !received ? `
            <button class="eom-received-btn"
              data-confirm-received="${escapeHTML(orderId)}">
              Đã nhận được hàng
            </button>
          ` : ""}

          ${received ? `
            <p class="eom-muted">Đơn hàng đã được xác nhận giao thành công ♡</p>
          ` : ""}
        </div>
      `;
    }).join("");
  }

  async function loadOrderHistory() {
    const content = $("eomOrderHistoryContent");
    if (content) {
      content.innerHTML = `<div class="eom-muted">Đang tải đơn hàng...</div>`;
    }

    try {
      const result = await callOrdersFunction({
        action: "get_orders"
      });

      const orders =
        result.orders ||
        result.data?.orders ||
        result.data ||
        [];

      renderOrderHistory(orders);
    } catch (error) {
      console.error("Load orders error:", error);

      if (content) {
        content.innerHTML = `
          <div class="eom-muted">
            Chưa thể tải lịch sử đơn hàng: ${escapeHTML(error.message)}
          </div>
        `;
      }
    }
  }

  async function openOrderHistory() {
    if (!currentUser) {
      openAuth("login");
      showMessage("Vui lòng đăng nhập để xem đơn hàng.");
      return;
    }

    createOrderHistoryModal();
    $("eomOrderHistoryModal").classList.remove("hidden");
    await loadOrderHistory();
  }

  // ========================================
  // 19. EVENT LISTENERS
  // ========================================

  loginBtn?.addEventListener("click", () => openAuth("login"));
  registerBtn?.addEventListener("click", () => openAuth("register"));
  closeAuthBtn?.addEventListener("click", closeAuth);

  authSwitchBtn?.addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "register" : "login");
  });

  cartBtn?.addEventListener("click", openCart);
  closeCartBtn?.addEventListener("click", closeCart);
  logoutBtn?.addEventListener("click", logoutCustomer);

  accountBtn?.addEventListener("click", openOrderHistory);

  productList?.addEventListener("click", event => {
    const button = event.target.closest("[data-add-product]");
    if (button) addToCart(button.dataset.addProduct);
  });

  cartItems?.addEventListener("click", event => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const productId = button.dataset.productId;
    const item = cart.find(entry => String(entry.id) === String(productId));

    if (!item) return;

    switch (button.dataset.cartAction) {
      case "increase":
        updateCartQuantity(productId, item.quantity + 1);
        break;
      case "decrease":
        updateCartQuantity(productId, item.quantity - 1);
        break;
      case "remove":
        removeFromCart(productId);
        break;
    }
  });

  checkoutBtn?.addEventListener("click", openCheckout);

  // ========================================
  // 20. AUTH STATE
  // ========================================

  db.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    if (!currentUser) {
      currentProfile = null;
      updateHeader();
      return;
    }

    updateHeader();

    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
      setTimeout(() => loadCurrentProfile(), 0);
    }
  });

  // ========================================
  // 21. INITIALIZE
  // ========================================

  async function initializeApp() {
    createEmailField();
    setAuthMode("login");

    renderCart();
    await loadProducts();
    await loadCurrentProfile();

    updateHeader();
  }

  initializeApp();

})();
