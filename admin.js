
(() => {
  "use strict";

  const config = window.EOMYSTERY_CONFIG;

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !window.supabase) {
    alert("Không tải được cấu hình Supabase. Hãy kiểm tra config.js.");
    return;
  }

  const db = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  const $ = id => document.getElementById(id);

  let products = [];
  let activeFilter = "selling";
  let selectedImage = null;
  let currentImageUrl = "";
  let currentUser = null;

  let selectedQrImage = null;
  let qrPreviewUrl = "";

  const money = value =>
    new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function toast(message) {
    const element = $("toast");
    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(
      () => element.classList.remove("show"),
      3000
    );
  }

  function setMessage(message, success = false) {
    const element = $("formMessage");
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("success", success);
  }

  function setQrMessage(message, success = false) {
    const element = $("qrMessage");
    if (!element) return;

    element.textContent = message;
    element.classList.toggle("success", success);
  }

  // ========================================
  // 1. AUTHENTICATION AND ADMIN CHECK
  // ========================================

  async function initialize() {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError || !sessionData.session) {
      showAccessError("Bạn cần đăng nhập tài khoản Admin trước.");
      return;
    }

    currentUser = sessionData.session.user;

    const { data: profile, error } = await db
      .from("profiles")
      .select("full_name, role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      showAccessError(
        "Không kiểm tra được quyền tài khoản: " + error.message
      );
      return;
    }

    if (!profile || profile.role !== "admin") {
      showAccessError("Tài khoản hiện tại chưa được cấp quyền Admin.");
      return;
    }

    $("adminName").textContent = profile.full_name || "Admin";

    await Promise.all([
      loadProducts(),
      loadCurrentQr()
    ]);
  }

  function showAccessError(message) {
    document.body.innerHTML = `
      <main style="
        min-height:100vh;display:grid;place-items:center;padding:24px;
        background:#fffaf7;font-family:'Nunito Sans',sans-serif;color:#51434a;
      ">
        <section style="
          max-width:430px;background:white;padding:35px;border-radius:20px;
          text-align:center;border:1px solid #f0e4e9;
        ">
          <div style="font-size:42px;color:#bd7895">♡</div>
          <h2 style="margin:8px 0">EOMYSTERY ADMIN</h2>
          <p>${escapeHTML(message)}</p>
          <a href="index.html" style="color:#bd7895;font-weight:800">
            Quay lại website
          </a>
        </section>
      </main>`;
  }

  // ========================================
  // 2. PRODUCT MANAGEMENT
  // ========================================

  async function loadProducts() {
    $("productGrid").innerHTML =
      '<div class="loading">Đang tải sản phẩm...</div>';

    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      $("productGrid").innerHTML = "";
      toast("Không tải được sản phẩm: " + error.message);
      return;
    }

    products = data || [];
    updateStats();
    renderProducts();
  }

  function getCategory(product) {
    if (!product.is_active) return "hidden";
    if (Number(product.stock) <= 0) return "soldout";
    return "selling";
  }

  function updateStats() {
    const counts = {
      selling: products.filter(p => getCategory(p) === "selling").length,
      soldout: products.filter(p => getCategory(p) === "soldout").length,
      hidden: products.filter(p => getCategory(p) === "hidden").length
    };

    $("totalCount").textContent = products.length;
    $("sellingCount").textContent = counts.selling;
    $("soldOutCount").textContent = counts.soldout;
    $("hiddenCount").textContent = counts.hidden;

    $("tabSelling").textContent = counts.selling;
    $("tabSoldout").textContent = counts.soldout;
    $("tabHidden").textContent = counts.hidden;
  }

  function renderProducts() {
    const keyword = $("searchInput").value.trim().toLowerCase();

    const filtered = products.filter(product => {
      const matchesCategory = getCategory(product) === activeFilter;
      const matchesSearch =
        String(product.name || "").toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });

    $("productGrid").innerHTML = "";
    $("emptyMessage").hidden = filtered.length > 0;

    filtered.forEach(product => {
      const category = getCategory(product);

      const statusText = {
        selling: "ĐANG BÁN",
        soldout: "HẾT HÀNG",
        hidden: "ĐÃ ẨN"
      }[category];

      const image = product.image_url
        ? `<img class="product-image ${category === "soldout" ? "soldout" : ""}"
             src="${escapeHTML(product.image_url)}"
             alt="${escapeHTML(product.name)}"
             loading="lazy">`
        : `<div class="product-image" style="
             display:grid;place-items:center;color:#bd7895;font-size:35px
           ">♡</div>`;

      const toggleButton = category === "hidden"
        ? `<button class="action-btn" data-action="show" data-id="${escapeHTML(product.id)}">Hiện lại</button>`
        : `<button class="action-btn" data-action="hide" data-id="${escapeHTML(product.id)}">Ẩn</button>`;

      const card = document.createElement("article");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-image-wrap">
          ${image}
          <span class="product-status ${category}">${statusText}</span>
        </div>
        <div class="product-info">
          <h3>${escapeHTML(product.name)}</h3>
          <p class="product-description">
            ${escapeHTML(product.description || "Chưa có mô tả sản phẩm.")}
          </p>
          <div class="product-meta">
            <span class="product-price">${money(product.price)}</span>
            <span class="product-stock">Tồn kho: ${Number(product.stock || 0)}</span>
          </div>
          <div class="product-actions">
            <button class="action-btn" data-action="edit" data-id="${escapeHTML(product.id)}">Sửa</button>
            <button class="action-btn" data-action="stock" data-id="${escapeHTML(product.id)}">Cập nhật kho</button>
            ${toggleButton}
            <button class="action-btn delete" data-action="delete" data-id="${escapeHTML(product.id)}">Xóa</button>
          </div>
        </div>`;

      $("productGrid").appendChild(card);
    });
  }

  function openModal(product = null) {
    $("productForm").reset();

    $("productId").value = product?.id || "";
    $("modalTitle").textContent =
      product ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới";

    $("saveProductBtn").textContent =
      product ? "Lưu thay đổi" : "Lưu sản phẩm";

    selectedImage = null;
    currentImageUrl = product?.image_url || "";

    $("productName").value = product?.name || "";
    $("productDescription").value = product?.description || "";
    $("productPrice").value = product?.price ?? "";
    $("productStock").value = product?.stock ?? 0;
    $("productActive").checked =
      product ? Boolean(product.is_active) : true;

    if (currentImageUrl) {
      $("imagePreview").src = currentImageUrl;
      $("imagePreview").hidden = false;
      $("uploadPlaceholder").hidden = true;
    } else {
      $("imagePreview").hidden = true;
      $("imagePreview").removeAttribute("src");
      $("uploadPlaceholder").hidden = false;
    }

    setMessage("");

    $("productModal").classList.add("open");
    $("productModal").setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("productModal").classList.remove("open");
    $("productModal").setAttribute("aria-hidden", "true");
    $("productForm").reset();

    selectedImage = null;
    $("productImage").value = "";
  }

  async function uploadImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
      ? extension
      : "jpg";

    const filePath =
      currentUser.id + "/" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 9) + "." + safeExtension;

    const { error } = await db.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (error) throw error;

    const { data } = db.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function saveProduct(event) {
    event.preventDefault();

    const name = $("productName").value.trim();
    const description = $("productDescription").value.trim();
    const price = Number($("productPrice").value);
    const stock = Number($("productStock").value);
    const isActive = $("productActive").checked;
    const id = $("productId").value;

    if (!name) return setMessage("Vui lòng nhập tên sản phẩm.");

    if (!Number.isFinite(price) || price < 0) {
      return setMessage("Giá sản phẩm không hợp lệ.");
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return setMessage(
        "Số lượng tồn kho phải là số nguyên từ 0 trở lên."
      );
    }

    if (!id && !selectedImage) {
      return setMessage("Vui lòng chọn ảnh sản phẩm.");
    }

    const button = $("saveProductBtn");
    button.disabled = true;
    button.textContent = "Đang lưu...";

    try {
      let imageUrl = currentImageUrl;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const productData = {
        name,
        description,
        price,
        stock,
        is_active: isActive,
        image_url: imageUrl
      };

      let result;

      if (id) {
        result = await db
          .from("products")
          .update(productData)
          .eq("id", id);
      } else {
        result = await db
          .from("products")
          .insert(productData);
      }

      if (result.error) throw result.error;

      closeModal();

      toast(id
        ? "Đã cập nhật sản phẩm ♡"
        : "Đã thêm sản phẩm mới ♡");

      await loadProducts();

    } catch (error) {
      setMessage("Không lưu được: " + error.message);

    } finally {
      button.disabled = false;
      button.textContent = id ? "Lưu thay đổi" : "Lưu sản phẩm";
    }
  }

  async function changeVisibility(product, visible) {
    const { error } = await db
      .from("products")
      .update({ is_active: visible })
      .eq("id", product.id);

    if (error) {
      toast("Không cập nhật được: " + error.message);
      return;
    }

    toast(visible
      ? "Đã hiển thị lại sản phẩm."
      : "Đã ẩn sản phẩm.");

    await loadProducts();
  }

  async function updateStock(product) {
    const answer = prompt(
      `Nhập số lượng tồn kho mới cho "${product.name}":`,
      String(product.stock ?? 0)
    );

    if (answer === null) return;

    const stock = Number(answer);

    if (!Number.isInteger(stock) || stock < 0) {
      toast("Số lượng phải là số nguyên từ 0 trở lên.");
      return;
    }

    const { error } = await db
      .from("products")
      .update({ stock })
      .eq("id", product.id);

    if (error) {
      toast("Không cập nhật được: " + error.message);
      return;
    }

    toast(stock === 0
      ? "Sản phẩm đã chuyển sang mục HẾT HÀNG."
      : "Đã cập nhật số lượng tồn kho.");

    await loadProducts();
  }

  async function deleteProduct(product) {
    const confirmed = confirm(
      `Bạn có chắc muốn xóa "${product.name}" không?\nThao tác này không thể hoàn tác.`
    );

    if (!confirmed) return;

    const { error } = await db
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      toast("Không xóa được: " + error.message);
      return;
    }

    toast("Đã xóa sản phẩm.");
    await loadProducts();
  }

  // ========================================
  // 3. PAYMENT QR MANAGEMENT
  // ========================================

  async function loadCurrentQr() {
    $("qrCurrentMessage").textContent = "Đang tải mã QR...";
    $("currentQrImage").hidden = true;
    $("currentQrPlaceholder").hidden = false;

    const { data, error } = await db
      .from("payment_settings")
      .select("qr_image_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      $("qrCurrentMessage").textContent =
        "Không tải được QR: " + error.message;
      return;
    }

    if (!data || !data.qr_image_url) {
      $("qrCurrentMessage").textContent =
        "Chưa có mã QR thanh toán. Hãy tải ảnh QR lên.";
      return;
    }

    $("currentQrImage").src = data.qr_image_url;
    $("currentQrImage").hidden = false;
    $("currentQrPlaceholder").hidden = true;

    $("qrCurrentMessage").textContent =
      "Mã QR hiện tại đang được sử dụng trên website.";
  }

  function resetQrSelection() {
    selectedQrImage = null;

    if (qrPreviewUrl) {
      URL.revokeObjectURL(qrPreviewUrl);
      qrPreviewUrl = "";
    }

    $("qrImageInput").value = "";
    $("qrImagePreview").removeAttribute("src");
    $("qrImagePreview").hidden = true;
    $("qrUploadPlaceholder").hidden = false;
    $("saveQrBtn").disabled = true;
  }

  function validateQrFile(file) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Ảnh QR tối đa 8 MB nhé.");
    }
  }

  async function uploadQrImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
      ? extension
      : "png";

    const filePath =
      currentUser.id + "/payment-qr-" +
      Date.now() + "-" +
      Math.random().toString(36).slice(2, 8) +
      "." + safeExtension;

    const { error: uploadError } = await db.storage
      .from("payment-qr")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    const { data } = db.storage
      .from("payment-qr")
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("Không lấy được đường dẫn ảnh QR.");
    }

    return {
      filePath,
      publicUrl: data.publicUrl
    };
  }

  async function saveQrImage() {
    if (!selectedQrImage) {
      setQrMessage("Vui lòng chọn ảnh QR trước.");
      return;
    }

    const button = $("saveQrBtn");
    button.disabled = true;
    button.textContent = "Đang cập nhật...";

    let uploadedFilePath = null;

    try {
      // Upload ảnh lên Storage trước.
      const uploaded = await uploadQrImage(selectedQrImage);

      uploadedFilePath = uploaded.filePath;

      // Cập nhật đường dẫn QR trong payment_settings.
      const { data, error } = await db
        .from("payment_settings")
        .update({
          qr_image_url: uploaded.publicUrl
        })
        .eq("id", 1)
        .select("id, qr_image_url")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "Không tìm thấy dòng cấu hình payment_settings có id = 1, hoặc tài khoản không có quyền cập nhật."
        );
      }

      // Cập nhật ảnh đang hiển thị trên Admin.
      $("currentQrImage").src = data.qr_image_url;
      $("currentQrImage").hidden = false;
      $("currentQrPlaceholder").hidden = true;

      $("qrCurrentMessage").textContent =
        "Mã QR mới đang được sử dụng trên website.";

      resetQrSelection();

      setQrMessage(
        "Đã cập nhật mã QR thanh toán thành công ♡",
        true
      );

      toast("Đã cập nhật mã QR thanh toán ♡");

    } catch (error) {
      console.error("Save QR error:", error);

      // Nếu ảnh đã upload nhưng cập nhật database thất bại,
      // thử xóa ảnh vừa upload để tránh file thừa.
      if (uploadedFilePath) {
        const { error: cleanupError } = await db.storage
          .from("payment-qr")
          .remove([uploadedFilePath]);

        if (cleanupError) {
          console.warn("Không xóa được ảnh QR tải lên lỗi:", cleanupError);
        }
      }

      setQrMessage("Không cập nhật được QR: " + error.message);
      button.disabled = false;
    } finally {
      button.textContent = "Cập nhật mã QR";

      if (!selectedQrImage) {
        button.disabled = true;
      }
    }
  }

  // ========================================
  // 4. EVENT LISTENERS
  // ========================================

  $("addProductBtn").addEventListener("click", () => openModal());

  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);

  $("refreshBtn").addEventListener("click", loadProducts);
  $("productForm").addEventListener("submit", saveProduct);
  $("searchInput").addEventListener("input", renderProducts);

  $("refreshQrBtn").addEventListener("click", loadCurrentQr);
  $("saveQrBtn").addEventListener("click", saveQrImage);

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(item =>
        item.classList.remove("active")
      );

      tab.classList.add("active");
      activeFilter = tab.dataset.filter;

      renderProducts();
    });
  });

  $("productImage").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast("Ảnh tối đa 8 MB nhé.");
      event.target.value = "";
      return;
    }

    selectedImage = file;

    const previewUrl = URL.createObjectURL(file);
    $("imagePreview").src = previewUrl;
    $("imagePreview").hidden = false;
    $("uploadPlaceholder").hidden = true;
  });

  $("qrImageInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateQrFile(file);

      selectedQrImage = file;

      if (qrPreviewUrl) {
        URL.revokeObjectURL(qrPreviewUrl);
      }

      qrPreviewUrl = URL.createObjectURL(file);

      $("qrImagePreview").src = qrPreviewUrl;
      $("qrImagePreview").hidden = false;
      $("qrUploadPlaceholder").hidden = true;

      $("saveQrBtn").disabled = false;

      setQrMessage("Ảnh QR đã sẵn sàng. Nhấn cập nhật để lưu.");

    } catch (error) {
      selectedQrImage = null;
      event.target.value = "";

      $("saveQrBtn").disabled = true;
      setQrMessage(error.message);
    }
  });

  $("productGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const product = products.find(p =>
      String(p.id) === String(button.dataset.id)
    );

    if (!product) return;

    const action = button.dataset.action;

    if (action === "edit") openModal(product);
    if (action === "stock") updateStock(product);
    if (action === "hide") changeVisibility(product, false);
    if (action === "show") changeVisibility(product, true);
    if (action === "delete") deleteProduct(product);
  });

  $("productModal").addEventListener("click", event => {
    if (event.target.matches("[data-close-modal]")) {
      closeModal();
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "index.html";
  });

  // ========================================
  // 5. START
  // ========================================

  initialize();

})();
