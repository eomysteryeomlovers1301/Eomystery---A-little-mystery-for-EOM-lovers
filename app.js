
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

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
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
  // 3. APP STATE
  // ========================================

  let authMode = "login";
  let currentUser = null;
  let currentProfile = null;
  let products = [];

  const CART_STORAGE_KEY = "eomystery_cart_v1";

  let cart = loadCart();

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
      phone = "+" + phone;
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
      authSubmitBtn.dataset.originalText =
        authSubmitBtn.textContent;
      authSubmitBtn.textContent = text || "Đang xử lý...";
    } else {
      authSubmitBtn.textContent =
        authSubmitBtn.dataset.originalText ||
        (authMode === "login" ? "Đăng nhập" : "Đăng ký");
    }
  }

  function openAuth(mode = "login") {
    setAuthMode(mode);

    if (authSection) {
      authSection.classList.remove("hidden");
    }
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
  // 6. LOGIN / REGISTER INTERFACE
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

    if (fullNameInput) {
      fullNameInput.required = isRegister;
    }

    if (confirmPasswordInput) {
      confirmPasswordInput.required = isRegister;
    }

    const emailInput = $("email");

    if (emailInput) {
      emailInput.required = isRegister;
    }

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
    const fullName = normalizeUnicode(
      fullNameInput?.value.trim()
    );

    const phone = normalizePhone(phoneInput?.value);
    const email = $("email")?.value.trim().toLowerCase();
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    if (!fullName || !phone || !email || !password) {
      showMessage("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    if (!/^\+84\d{9,10}$/.test(phone)) {
      showMessage(
        "Số điện thoại chưa đúng. Bơ hãy nhập số điện thoại Việt Nam hợp lệ."
      );
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
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone
          },
          emailRedirectTo: window.location.origin +
            window.location.pathname
        }
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("Không thể tạo tài khoản. Vui lòng thử lại.");
      }

      if (data.session) {
        await db.auth.signOut();
      }

      authForm?.reset();

      showMessage(
        "Đăng ký thành công! Hãy kiểm tra email để xác nhận tài khoản trước khi đăng nhập.",
        "success"
      );

    } catch (error) {
      console.error("Register error:", error);

      let message = error.message || "Đăng ký thất bại.";

      if (
        message.toLowerCase().includes("duplicate") ||
        message.toLowerCase().includes("unique")
      ) {
        message = "Số điện thoại hoặc thông tin tài khoản đã được sử dụng.";
      }

      showMessage(message);

    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // 8. LOGIN WITH PHONE
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
          body: {
            phone,
            password
          }
        }
      );

      if (error) throw error;

      if (
        !data ||
        !data.access_token ||
        !data.refresh_token
      ) {
        throw new Error(
          "Không nhận được phiên đăng nhập. Vui lòng thử lại."
        );
      }

      const { error: sessionError } = await db.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      if (sessionError) throw sessionError;

      authForm?.reset();
      closeAuth();

      await loadCurrentProfile();

      alert("Đăng nhập thành công. Chào mừng Bơ đến với EOMYSTERY!");

    } catch (error) {
      console.error("Login error:", error);

      showMessage(
        "Đăng nhập chưa thành công. Hãy kiểm tra số điện thoại, mật khẩu hoặc thử lại sau."
      );

    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // 9. AUTH FORM SUBMIT
  // ========================================

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (authMode === "register") {
      await registerCustomer();
    } else {
      await loginCustomer();
    }
  });

  // ========================================
  // 10. CURRENT PROFILE
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

    if (error) {
      console.error("Profile error:", error);
    }

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
      accountBtn.textContent =
        currentProfile?.full_name || "Tài khoản";
      accountBtn.title = "Tài khoản của bạn";
    }
  }

  // ========================================
  // 11. LOGOUT
  // ========================================

  async function logoutCustomer() {
    const confirmed = window.confirm(
      "Bơ có chắc muốn đăng xuất khỏi EOMYSTERY không?"
    );

    if (!confirmed) return;

    const { error } = await db.auth.signOut();

    if (error) {
      alert("Đăng xuất chưa thành công. Vui lòng thử lại.");
      return;
    }

    currentUser = null;
    currentProfile = null;

    updateHeader();

    alert("Bơ đã đăng xuất khỏi EOMYSTERY.");
  }

  // ========================================
  // 12. LOAD PRODUCTS
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
          Chưa thể tải sản phẩm. Bơ hãy thử tải lại trang nhé.
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
        <div class="empty-state">
          Sản phẩm sẽ được cập nhật sớm ♡
        </div>
      `;
      return;
    }

    productList.innerHTML = products.map((product) => {
      const outOfStock = Number(product.stock) <= 0;
      const image = product.image_url
        ? `
          <img
            src="${escapeHTML(product.image_url)}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
          >
        `
        : `<div class="product-no-image">EOMYSTERY ♡</div>`;

      return `
        <article class="product-card ${outOfStock ? "out-of-stock" : ""}">
          <div class="product-image">
            ${image}
            ${
              outOfStock
                ? '<span class="stock-overlay">HẾT HÀNG</span>'
                : ""
            }
          </div>

          <div class="product-info">
            <h3>${escapeHTML(normalizeUnicode(product.name))}</h3>

            <p class="product-description">
              ${escapeHTML(normalizeUnicode(product.description || ""))}
            </p>

            <p class="product-price">
              ${formatMoney(product.price)}
            </p>

            <p class="product-stock">
              ${outOfStock
                ? "Tạm hết hàng"
                : `Còn ${Number(product.stock)} sản phẩm`}
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
  // 13. CART STORAGE
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
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart)
    );
  }

  function addToCart(productId) {
    const product = products.find(
      (item) => String(item.id) === String(productId)
    );

    if (!product) return;

    if (Number(product.stock) <= 0) {
      alert("Sản phẩm hiện đã hết hàng.");
      return;
    }

    const existing = cart.find(
      (item) => String(item.id) === String(productId)
    );

    if (existing) {
      if (existing.quantity >= Number(product.stock)) {
        alert("Số lượng trong giỏ đã đạt giới hạn tồn kho.");
        return;
      }

      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        quantity: 1
      });
    }

    saveCart();
    renderCart();

    alert("Đã thêm sản phẩm vào giỏ hàng ♡");
  }

  function updateCartQuantity(productId, quantity) {
    const product = products.find(
      (item) => String(item.id) === String(productId)
    );

    const item = cart.find(
      (entry) => String(entry.id) === String(productId)
    );

    if (!item || !product) return;

    const newQuantity = Number(quantity);

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > Number(product.stock)) {
      alert("Số lượng vượt quá tồn kho hiện tại.");
      return;
    }

    item.quantity = newQuantity;
    saveCart();
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter(
      (item) => String(item.id) !== String(productId)
    );

    saveCart();
    renderCart();
  }

  // ========================================
  // 14. RENDER CART
  // ========================================

  function renderCart() {
    if (!cartItems) return;

    let total = 0;
    let totalQuantity = 0;

    const validItems = cart.map((item) => {
      const product = products.find(
        (entry) => String(entry.id) === String(item.id)
      );

      if (!product) return null;

      const quantity = Math.min(
        Math.max(1, Number(item.quantity) || 1),
        Math.max(1, Number(product.stock))
      );

      return {
        product,
        quantity
      };
    }).filter(Boolean);

    cart = validItems.map(({ product, quantity }) => ({
      id: product.id,
      quantity
    }));

    saveCart();

    if (!validItems.length) {
      cartItems.innerHTML = `
        <div class="empty-state">
          Giỏ hàng của Bơ đang trống ♡
        </div>
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
              <button
                type="button"
                data-cart-action="decrease"
                data-product-id="${escapeHTML(product.id)}"
                aria-label="Giảm số lượng"
              >−</button>

              <span>${quantity}</span>

              <button
                type="button"
                data-cart-action="increase"
                data-product-id="${escapeHTML(product.id)}"
                aria-label="Tăng số lượng"
              >+</button>

              <button
                type="button"
                class="cart-remove"
                data-cart-action="remove"
                data-product-id="${escapeHTML(product.id)}"
              >Xóa</button>
            </div>

            <strong class="cart-subtotal">
              ${formatMoney(subtotal)}
            </strong>
          </div>
        `;
      }).join("");
    }

    if (cartTotal) {
      cartTotal.textContent = formatMoney(total);
    }

    if (cartCount) {
      cartCount.textContent = String(totalQuantity);
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = validItems.length === 0;
    }
  }

  // ========================================
  // 15. EVENT LISTENERS
  // ========================================

  loginBtn?.addEventListener("click", () => openAuth("login"));

  registerBtn?.addEventListener("click", () => openAuth("register"));

  closeAuthBtn?.addEventListener("click", closeAuth);

  authSwitchBtn?.addEventListener("click", () => {
    setAuthMode(
      authMode === "login" ? "register" : "login"
    );
  });

  cartBtn?.addEventListener("click", openCart);

  closeCartBtn?.addEventListener("click", closeCart);

  logoutBtn?.addEventListener("click", logoutCustomer);

  accountBtn?.addEventListener("click", () => {
    if (currentProfile) {
      alert(
        `Xin chào ${currentProfile.full_name || "EOM lover"} ♡\n\n` +
        `Tài khoản của bạn đã đăng nhập thành công.`
      );
    }
  });

  productList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-product]");

    if (!button) return;

    addToCart(button.dataset.addProduct);
  });

  cartItems?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");

    if (!button) return;

    const productId = button.dataset.productId;
    const item = cart.find(
      (entry) => String(entry.id) === String(productId)
    );

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

  checkoutBtn?.addEventListener("click", () => {
    if (!currentUser) {
      closeCart();
      openAuth("login");
      showMessage("Bơ hãy đăng nhập trước khi đặt hàng.");
      return;
    }

    alert(
      "Giỏ hàng đã sẵn sàng ♡\n\n" +
      "Phần thanh toán và đặt hàng sẽ được triển khai ở bước tiếp theo."
    );
  });

  // ========================================
  // 16. AUTH STATE LISTENER
  // ========================================

  db.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    if (!currentUser) {
      currentProfile = null;
      updateHeader();
      return;
    }

    updateHeader();

    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      setTimeout(() => {
        loadCurrentProfile();
      }, 0);
    }
  });

  // ========================================
  // 17. INITIALIZE APP
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
