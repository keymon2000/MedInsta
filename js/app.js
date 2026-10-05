/* ------------------------------------------------------------------
   MedInsta — Mobile app state machine + rendering (Medicine Continuity)
   ------------------------------------------------------------------ */

const MC = (() => {

  const TAB_SCREENS = ["home", "search", "bag", "orders", "account"];
  const CAT_ICONS = {
    "Pain Relief": "💊",
    "Diabetes Care": "🩸",
    "Vitamins & Supplements": "🍊",
    "Skin Care": "🧴",
    "Cold & Immunity": "🤧",
  };

  let state = null;
  let cartReminderTimer = null;

  function cloneReorderItems() {
    return MC_DATA.previousOrder.items.map(it => ({
      ...it,
      included: it.status === "ok",
      decision: null,
      decisionLabel: null,
    }));
  }

  function init() {
    state = {
      items: cloneReorderItems(),
      exceptionQueue: [],
      exceptionIndex: 0,
      pendingChoice: null,
      bag: [],
      searchQuery: "",
      activeCategory: "All",
      activeCatalogId: null,
      purchaseMode: {},
      deliverySpeed: "standard",
      agentSeen: false,
      currentScreen: "home",
      restockWatchlist: [],
      cartReminderReady: false,
      searchHistory: [...MC_DATA.defaultSearchHistory],
      placedOrders: [
        {
          id: MC_DATA.previousOrder.id,
          date: MC_DATA.previousOrder.date,
          total: MC_DATA.previousOrder.total,
          itemCount: MC_DATA.previousOrder.items.length,
          status: "Delivered",
        },
      ],
    };

    document.getElementById("home-name").textContent = MC_DATA.customer.name;
    document.getElementById("account-name").textContent = MC_DATA.customer.name;
    document.getElementById("home-refill").textContent = MC_DATA.customer.nextRefillEstimate;
    document.getElementById("home-last-total").textContent = "₹" + MC_DATA.previousOrder.total.toLocaleString("en-IN");
    document.getElementById("home-item-count").textContent = MC_DATA.previousOrder.items.length + " medicines";

    renderHomeCategories();
    updateBagBadge();
    renderAgentBubble();
    go("home");
  }

  const AGENT_HIDDEN_SCREENS = ["reorder", "exc-unavailable", "exc-prescription", "cart"];

  function go(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById("screen-" + name);
    if (el) el.classList.add("active");
    state.currentScreen = name;

    const nav = document.getElementById("bottom-nav");
    if (TAB_SCREENS.includes(name)) {
      nav.style.display = "flex";
      document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === name));
    } else {
      nav.style.display = "none";
    }

    const bubble = document.getElementById("agent-bubble");
    bubble.classList.toggle("hide", AGENT_HIDDEN_SCREENS.includes(name));

    if (name === "reorder") renderReorder();
    if (name === "cart") renderCart();
    if (name === "confirm") renderConfirm();
    if (name === "trust") renderTrust();
    if (name === "search") renderSearch();
    if (name === "substitutes") renderSubstitutes();
    if (name === "bag") { state.cartReminderReady = false; renderBag(); }
    if (name === "orders") renderOrders();

    const body = el && el.querySelector(".screen-body");
    if (body) body.scrollTop = 0;
  }

  // ---------------- Home ----------------

  function renderHomeCategories() {
    const row = document.getElementById("home-cat-row");
    row.innerHTML = MC_DATA.categories.filter(c => c !== "All").map(cat => `
      <div class="home-cat-chip" onclick="MC.openCategory('${cat}')">
        <span class="hc-ico">${CAT_ICONS[cat] || "💊"}</span>${cat}
      </div>
    `).join("");
  }

  function openCategory(cat) {
    state.activeCategory = cat;
    state.searchQuery = "";
    go("search");
  }

  // ---------------- Review & Reorder ----------------

  function statusBadge(item) {
    if (item.status === "ok") return `<span class="status-badge ok">✓ Available</span>`;
    if (item.decision) {
      return item.included
        ? `<span class="status-badge ok">✓ Resolved</span>`
        : `<span class="status-badge excluded">— Excluded</span>`;
    }
    if (item.availability === "unavailable") return `<span class="status-badge warn">⚠ Unavailable</span>`;
    return `<span class="status-badge warn">⚠ Verification needed</span>`;
  }

  function renderReorder() {
    const list = document.getElementById("med-list");
    list.innerHTML = state.items.map(item => `
      <div class="med-item">
        <div class="med-icon">💊</div>
        <div class="med-info">
          <div class="med-name">${item.name}</div>
          <div class="med-meta">Qty ${item.qty} · ₹${item.price}</div>
          <div class="med-price">${statusBadge(item)}</div>
        </div>
      </div>
    `).join("");

    const attentionCount = state.items.filter(i => i.status === "attention" && !i.decision).length;
    const readyCount = state.items.length - attentionCount;
    document.getElementById("reorder-summary").innerHTML =
      `<span class="ok-count">${readyCount} medicine${readyCount !== 1 ? "s" : ""} ready</span>
       <span class="warn-count">${attentionCount} need${attentionCount === 1 ? "s" : ""} attention</span>`;

    const btn = document.getElementById("resolve-btn");
    btn.textContent = attentionCount > 0 ? "Resolve & Continue" : "Continue to Order";
  }

  // ---------------- Exception flow ----------------

  function startExceptionFlow() {
    state.exceptionQueue = state.items.filter(i => i.status === "attention" && i.decision === null);
    state.exceptionIndex = 0;
    showNextException();
  }

  function showNextException() {
    if (state.exceptionIndex >= state.exceptionQueue.length) {
      go("cart");
      return;
    }
    const item = state.exceptionQueue[state.exceptionIndex];
    state.pendingChoice = null;

    if (item.availability === "unavailable") {
      renderUnavailableScreen(item);
      go("exc-unavailable");
    } else {
      renderPrescriptionScreen(item);
      go("exc-prescription");
    }
  }

  function progressDots(containerId, total, doneIndex) {
    const dots = document.getElementById(containerId);
    dots.innerHTML = Array.from({ length: total }).map((_, i) =>
      `<span class="${i <= doneIndex ? "done" : ""}"></span>`
    ).join("");
  }

  function renderUnavailableScreen(item) {
    document.getElementById("exc-unavail-progress").textContent =
      `Issue ${state.exceptionIndex + 1} of ${state.exceptionQueue.length}`;
    progressDots("exc-unavail-dots", state.exceptionQueue.length, state.exceptionIndex);
    document.getElementById("exc-unavail-title").textContent = `${item.name} is currently unavailable`;
    document.getElementById("exc-unavail-reason").textContent = item.reason;

    const optWrap = document.getElementById("exc-unavail-options");
    optWrap.innerHTML = MC_DATA.recoveryOptions.unavailable.map(opt => `
      <label class="option-item" data-opt="${opt.id}">
        <input type="radio" name="unavail-opt" value="${opt.id}" onchange="MC.selectUnavailableOption('${opt.id}')" />
        <div>
          <div class="o-label">${opt.label}</div>
          <div class="o-desc">${opt.description}</div>
        </div>
      </label>
    `).join("");
    document.getElementById("exc-unavail-continue").disabled = true;
    optWrap.querySelectorAll(".option-item").forEach(el => el.classList.remove("selected"));
  }

  function selectUnavailableOption(optId) {
    state.pendingChoice = optId;
    document.querySelectorAll("#exc-unavail-options .option-item").forEach(el => {
      el.classList.toggle("selected", el.dataset.opt === optId);
    });
    document.getElementById("exc-unavail-continue").disabled = false;
  }

  function applyUnavailableResolution(item, opt) {
    item.decision = opt.id;
    item.decisionLabel = opt.label;
    item.included = false;
  }

  function confirmUnavailableChoice() {
    const item = state.exceptionQueue[state.exceptionIndex];
    const opt = MC_DATA.recoveryOptions.unavailable.find(o => o.id === state.pendingChoice);
    applyUnavailableResolution(item, opt);
    state.exceptionIndex++;
    showNextException();
  }

  function rxBrandOptionHtml(item, sub) {
    return `
      <div class="rx-brand-card">
        <div style="flex:1;min-width:0;">
          <div class="product-name">${sub.name}</div>
          <div class="product-meta">${sub.manufacturer} · ${sub.packSize}</div>
          ${manufacturerTrustHtml(sub.manufacturer)}
          <div class="product-price-row">
            <span class="product-price">₹${sub.price}</span>
            <span class="product-mrp">₹${sub.mrp}</span>
            <span class="product-discount">${sub.discountPct}% off</span>
          </div>
          <span class="match-badge">✓ Same constituent — ${item.constituent}</span>
        </div>
        <button class="sub-add-btn" onclick="MC.selectPrescriptionSubstitute('${sub.id}')">Select &amp; Verify</button>
      </div>
    `;
  }

  function renderPrescriptionScreen(item) {
    document.getElementById("exc-presc-progress").textContent =
      `Issue ${state.exceptionIndex + 1} of ${state.exceptionQueue.length}`;
    progressDots("exc-presc-dots", state.exceptionQueue.length, state.exceptionIndex);
    document.getElementById("exc-presc-reason").textContent = item.reason;

    document.getElementById("rx-onfile-info").innerHTML = `
      <span class="r-ico">🩺</span>
      <div>
        <div class="r-title">Prescription on file</div>
        <div class="r-sub">Written for ${item.constituent}</div>
      </div>
    `;
    document.getElementById("rx-brand-options").innerHTML = (item.substitutes || [])
      .map(sub => rxBrandOptionHtml(item, sub)).join("");

    const box = document.getElementById("upload-box");
    box.classList.remove("done");
    document.getElementById("upload-text").textContent = "No prescription uploaded yet";
    document.getElementById("exc-presc-continue").disabled = true;
    state.pendingChoice = null;
  }

  function applySubstituteResolution(item, sub) {
    item.decision = "substitute_verified";
    item.decisionLabel = `Switched to ${sub.name} — prescription verified via constituent match`;
    item.included = true;
    item.pendingVerification = false;
    item.prescriptionVerifiedVia = "constituent";
    item.verifiedConstituentName = item.constituent;
    item.originalName = item.originalName || item.name;
    item.name = sub.name;
    item.manufacturer = sub.manufacturer;
    item.price = sub.price;
  }

  function selectPrescriptionSubstitute(subId) {
    const item = state.exceptionQueue[state.exceptionIndex];
    const sub = (item.substitutes || []).find(s => s.id === subId);
    if (!sub) return;

    applySubstituteResolution(item, sub);
    state.exceptionIndex++;
    showNextException();
  }

  function uploadPrescriptionDemo() {
    const box = document.getElementById("upload-box");
    box.classList.add("done");
    document.getElementById("upload-text").textContent = "Prescription uploaded — pending pharmacist review";
    state.pendingChoice = "upload";
    document.getElementById("exc-presc-continue").disabled = false;
  }

  function requestHelp() {
    state.pendingChoice = "help";
    document.getElementById("exc-presc-continue").disabled = false;
    const box = document.getElementById("upload-box");
    box.classList.remove("done");
    document.getElementById("upload-text").textContent = "Help requested — a pharmacist will contact you";
  }

  function confirmPrescriptionChoice() {
    const item = state.exceptionQueue[state.exceptionIndex];
    if (state.pendingChoice === "upload") {
      item.decision = "upload";
      item.decisionLabel = "Prescription uploaded — pending pharmacist review";
      item.included = true;
      item.pendingVerification = true;
    } else {
      item.decision = "help";
      item.decisionLabel = "Help requested from pharmacist";
      item.included = false;
    }
    state.exceptionIndex++;
    showNextException();
  }

  // ---------------- Delivery speed ----------------

  function deliveryToggleHtml() {
    const speed = state.deliverySpeed;
    const d = MC_DATA.delivery;
    return `
      <div class="delivery-toggle">
        <div class="dt-option ${speed === "standard" ? "active" : ""}" onclick="MC.setDeliverySpeed('standard')">
          <div class="dt-title">Standard Delivery</div>
          <div class="dt-sub">Free · ${d.standardEtaText}</div>
        </div>
        <div class="dt-option dt-option-new ${speed === "express" ? "active" : ""}" onclick="MC.setDeliverySpeed('express')">
          <div class="dt-title">⚡ Express Delivery <span class="new-badge">NEW</span></div>
          <div class="dt-sub">+₹${d.expressCost} · ${d.expressEtaText}</div>
        </div>
      </div>
    `;
  }

  function setDeliverySpeed(speed) {
    state.deliverySpeed = speed;
    if (document.getElementById("screen-cart").classList.contains("active")) renderCart();
    if (document.getElementById("screen-bag").classList.contains("active")) renderBag();
  }

  function deliveryCost() {
    return state.deliverySpeed === "express" ? MC_DATA.delivery.expressCost : 0;
  }

  // ---------------- Cart (Smart Reorder checkout) ----------------

  function rxLineStatusHtml(item) {
    if (!item.included) return "";
    if (item.prescriptionVerifiedVia === "constituent") {
      return `<div class="rx-line-status verified">✓ Prescription verified — constituent match (${item.verifiedConstituentName})</div>`;
    }
    if (item.pendingVerification) {
      return `<div class="rx-line-status pending">⏳ Prescription pending pharmacist review</div>`;
    }
    if (item.prescriptionRequired) {
      return `<div class="rx-line-status verified">✓ Prescription verified</div>`;
    }
    return "";
  }

  function renderCart() {
    const included = state.items.filter(i => i.included);
    const excluded = state.items.filter(i => !i.included);

    const verifiedViaSub = included.filter(i => i.prescriptionVerifiedVia === "constituent").length;
    const pendingRx = included.filter(i => i.pendingVerification).length;
    const rxBanner = document.getElementById("cart-rx-banner");
    rxBanner.innerHTML = (verifiedViaSub || pendingRx) ? `
      <div class="rx-banner">
        🩺 <b>Prescription Processing</b><br/>
        ${verifiedViaSub ? `${verifiedViaSub} medicine${verifiedViaSub !== 1 ? "s" : ""} verified via constituent match (brand substitution allowed)` : ""}
        ${verifiedViaSub && pendingRx ? " · " : ""}
        ${pendingRx ? `${pendingRx} pending pharmacist review` : ""}
      </div>
    ` : "";

    document.getElementById("cart-lines").innerHTML = state.items.map(item => `
      <div class="cart-line ${item.included ? "" : "excluded"}">
        <div>
          <div class="cl-name">${item.name}</div>
          <div class="cl-meta">${item.included ? `Qty ${item.qty}` : (item.decisionLabel || "Excluded")}</div>
          ${rxLineStatusHtml(item)}
        </div>
        <div class="cl-price">${item.included ? "₹" + item.price : "—"}</div>
      </div>
    `).join("");

    const exclWrap = document.getElementById("cart-excluded-notes");
    exclWrap.innerHTML = excluded.length ? `
      <div class="excluded-note">
        ${excluded.length} medicine${excluded.length !== 1 ? "s" : ""} not included this time —
        you won't be charged, and we'll follow up separately for each.
      </div>` : "";

    document.getElementById("cart-delivery").innerHTML = deliveryToggleHtml();

    const subtotal = included.reduce((sum, i) => sum + i.price, 0);
    const delivery = deliveryCost();
    const total = subtotal + delivery;
    const prevTotal = MC_DATA.previousOrder.total;

    document.getElementById("cart-totals").innerHTML = `
      ${excluded.length ? `<div class="delta-note">Previous order was ₹${prevTotal.toLocaleString("en-IN")}.
        This order is ₹${(subtotal).toLocaleString("en-IN")} before delivery because ${excluded.length}
        medicine${excluded.length !== 1 ? "s" : ""} moved to exception handling and ${excluded.length !== 1 ? "aren't" : "isn't"} charged yet.</div>` : ""}
      <div class="ct-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
      <div class="ct-row"><span>Delivery</span><span>${delivery > 0 ? "₹" + delivery : "Free"}</span></div>
      <div class="ct-row total"><span>Total</span><span>₹${total.toLocaleString("en-IN")}</span></div>
    `;
  }

  function placeOrder() {
    const included = state.items.filter(i => i.included);
    const total = included.reduce((sum, i) => sum + i.price, 0) + deliveryCost();
    let entry = state.placedOrders.find(o => o.id === "ORD-1051");
    if (!entry) {
      entry = { id: "ORD-1051", date: "Today", total: 0, itemCount: 0, status: "Processing" };
      state.placedOrders.push(entry);
    }
    entry.total = total;
    entry.itemCount = included.length;
    entry.status = "Processing";
    entry.date = "Today";
    entry.deliverySpeed = state.deliverySpeed;
    go("confirm");
  }

  function renderConfirm() {
    const included = state.items.filter(i => i.included);
    const excluded = state.items.filter(i => !i.included);
    const d = MC_DATA.delivery;
    const etaText = state.deliverySpeed === "express" ? d.expressEtaText : d.standardEtaText;
    document.getElementById("confirm-summary").innerHTML = `
      <div class="ct-row" style="padding:2px 0;"><span>Medicines in this order</span><span><b>${included.length}</b></span></div>
      <div class="ct-row" style="padding:2px 0;"><span>Being followed up separately</span><span><b>${excluded.length}</b></span></div>
      <div class="ct-row" style="padding:2px 0;"><span>Delivery speed</span><span><b>${state.deliverySpeed === "express" ? "⚡ Express" : "Standard"}</b></span></div>
      <div class="ct-row" style="padding:2px 0;"><span>Estimated delivery</span><span><b>${etaText}</b></span></div>
    `;
  }

  // ---------------- Trust timeline ----------------

  function renderTrust() {
    const t = MC_DATA.trustTimeline;
    document.getElementById("trust-timeline").innerHTML = t.steps.map(step => `
      <div class="t-step ${step.state}">
        <div class="t-line"></div>
        <div class="t-dot">${step.state === "done" ? "✓" : ""}</div>
        <div>
          <div class="t-label">${step.label}</div>
          <div class="t-time">${step.time}</div>
        </div>
      </div>
    `).join("");

    const d = t.delay;
    document.getElementById("delay-head-text").textContent = d.reasonTitle;
    document.getElementById("delay-body").innerHTML = `
      <p style="margin:10px 0 0;">${d.reasonBody}</p>
      <div class="eta-row"><span>Updated ETA</span><b>${d.updatedEta}</b></div>
      <div class="eta-row"><span>Last updated</span><b>${d.lastUpdated}</b></div>
    `;
  }

  function toggleDelay() {
    document.getElementById("delay-box").classList.toggle("open");
  }

  function restart() {
    state.items = cloneReorderItems();
    state.exceptionQueue = [];
    state.exceptionIndex = 0;
    state.pendingChoice = null;
    go("home");
  }

  // ---------------- Search / Catalog ----------------

  function manufacturerTrustHtml(name) {
    const m = MC_DATA.manufacturers[name];
    if (!m) return "";
    return `
      <div class="brand-trust-strip">
        <span class="bt-name">${name}</span>
        <span class="bt-rating">★ ${m.rating}</span>
        <span class="bt-verified">✓ ${m.badge}</span>
      </div>
    `;
  }

  function manufacturerTrustMiniHtml(name) {
    const m = MC_DATA.manufacturers[name];
    if (!m) return "";
    return `
      <div class="brand-trust-mini">
        <span class="btm-name">${name}</span>
        <span class="btm-rating">★ ${m.rating}</span>
      </div>
    `;
  }

  function productCardHtml(item) {
    return `
      <div class="product-card" onclick="MC.openProduct('${item.id}')">
        <div class="product-thumb">💊</div>
        <div class="product-info">
          <div class="product-name">${item.name}</div>
          <div class="product-meta">${item.manufacturer} · ${item.packSize}</div>
          <div class="product-rating"><span class="stars">★ ${item.rating}</span> (${item.reviews})</div>
          ${manufacturerTrustMiniHtml(item.manufacturer)}
          <div class="product-price-row">
            <span class="product-price">₹${item.price}</span>
            <span class="product-mrp">₹${item.mrp}</span>
            <span class="product-discount">${item.discountPct}% off</span>
          </div>
          ${item.prescriptionRequired ? '<span class="rx-chip">Rx Required</span>' : ""}
          ${item.inStock === false
            ? '<div class="oos-badge">⛔ Out of stock</div>'
            : `<span class="sub-count-chip">${item.substitutes.length} cheaper alternatives available</span>`}
        </div>
      </div>
    `;
  }

  function renderSearchLanding() {
    const historyHtml = state.searchHistory.length ? `
      <div class="section-label" style="margin-top:0;">Recent searches</div>
      <div class="history-chip-row">
        ${state.searchHistory.map((term, i) => `<div class="history-chip" onclick="MC.searchFromHistory(${i})"><span>🕐</span>${term}</div>`).join("")}
      </div>
      <div class="clear-history-link" onclick="MC.clearHistory()">Clear search history</div>
    ` : "";

    const trending = MC_DATA.catalog.slice(0, 4);
    const trendingHtml = `
      <div class="section-label" style="margin-top:0;">Trending near you</div>
      <div class="trending-row">
        ${trending.map(item => `
          <div class="trend-chip" onclick="MC.openProduct('${item.id}')">
            <span class="trend-ico">💊</span>
            <div class="trend-name">${item.name}</div>
            <div class="trend-price">₹${item.price}</div>
          </div>
        `).join("")}
      </div>
    `;

    return historyHtml + trendingHtml;
  }

  function renderSearch() {
    document.getElementById("search-input").value = state.searchQuery;

    const chipRow = document.getElementById("category-chip-row");
    chipRow.innerHTML = MC_DATA.categories.map(cat => `
      <div class="filter-chip ${state.activeCategory === cat ? "active" : ""}" onclick="MC.setCategory('${cat}')">${cat}</div>
    `).join("");

    const q = state.searchQuery.trim().toLowerCase();
    const label = document.getElementById("search-result-label");
    const resWrap = document.getElementById("search-results");

    if (!q && state.activeCategory === "All") {
      label.textContent = "Explore";
      resWrap.innerHTML = renderSearchLanding();
      return;
    }

    const results = MC_DATA.catalog.filter(item => {
      const matchesCat = state.activeCategory === "All" || item.category === state.activeCategory;
      const matchesQuery = !q ||
        item.name.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });

    label.textContent = q
      ? `Results for "${state.searchQuery}"`
      : (state.activeCategory === "All" ? "All products" : state.activeCategory);

    resWrap.innerHTML = results.length
      ? results.map(productCardHtml).join("")
      : `<div class="no-results">No medicines matched your search.<br/>Try a different name or category.</div>`;
  }

  function setCategory(cat) {
    state.activeCategory = cat;
    renderSearch();
  }

  function onSearchInput(val) {
    state.searchQuery = val;
    renderSearch();
  }

  function searchFromHistory(idx) {
    const term = state.searchHistory[idx];
    state.searchHistory = [term, ...state.searchHistory.filter((t, i) => i !== idx)];
    state.searchQuery = term;
    renderSearch();
  }

  function clearHistory() {
    state.searchHistory = [];
    renderSearch();
  }

  function openProduct(id) {
    state.activeCatalogId = id;
    go("substitutes");
  }

  // Subscribe & Save: 10% extra off for recurring delivery every 30 days.
  const SUBSCRIBE_DISCOUNT = 0.10;

  function getMode(id) {
    return state.purchaseMode[id] || "onetime";
  }

  function setPurchaseMode(id, mode) {
    state.purchaseMode[id] = mode;
    renderSubstitutes();
  }

  function computePrice(basePrice, mode) {
    return mode === "subscribe" ? Math.round(basePrice * (1 - SUBSCRIBE_DISCOUNT)) : basePrice;
  }

  function bagKey(id, mode) {
    return `${id}::${mode}`;
  }

  function purchaseToggleHtml(id, mode, small) {
    return `
      <div class="purchase-toggle ${small ? "small" : ""}">
        <button class="pt-btn ${mode === "onetime" ? "active" : ""}" onclick="MC.setPurchaseMode('${id}','onetime')">One-time</button>
        <button class="pt-btn ${mode === "subscribe" ? "active" : ""}" onclick="MC.setPurchaseMode('${id}','subscribe')">🔁 Subscribe & Save</button>
      </div>
    `;
  }

  function origCardHtml(item) {
    if (item.inStock === false) {
      const watching = state.restockWatchlist.includes(item.id);
      return `
        <div class="orig-card">
          <div class="orig-label">You selected</div>
          <div class="product-name" style="font-size:15px;">${item.name}</div>
          <div class="product-meta">${item.manufacturer} · ${item.packSize}</div>
          ${item.constituent ? `<div class="constituent-line">Constituent: ${item.constituent}</div>` : ""}
          ${manufacturerTrustHtml(item.manufacturer)}
          <div class="oos-badge">⛔ Out of stock</div>
          <p style="font-size:12px;color:var(--color-text-muted);margin:4px 0 10px;">${item.stockReason || "Currently unavailable."}</p>
          <button class="watch-btn ${watching ? "watching" : ""}" onclick="MC.watchRestock('${item.id}')" ${watching ? "disabled" : ""}>
            ${watching ? "🔔 Watching for restock — MediBuddy will notify you" : "🔔 Notify me when back in stock"}
          </button>
        </div>
      `;
    }

    const mode = getMode(item.id);
    const displayPrice = computePrice(item.price, mode);
    const key = bagKey(item.id, mode);
    return `
      <div class="orig-card">
        <div class="orig-label">You selected</div>
        <div class="product-name" style="font-size:15px;">${item.name}</div>
        <div class="product-meta">${item.manufacturer} · ${item.packSize}</div>
        ${item.constituent ? `<div class="constituent-line">Constituent: ${item.constituent}</div>` : ""}
        ${manufacturerTrustHtml(item.manufacturer)}
        ${purchaseToggleHtml(item.id, mode, false)}
        <div class="product-price-row">
          <span class="product-price">₹${displayPrice}</span>
          <span class="product-mrp">₹${item.mrp}</span>
          <span class="product-discount">${mode === "subscribe" ? "Extra 10% off" : item.discountPct + "% off"}</span>
        </div>
        ${mode === "subscribe" ? `<div class="sub-save-note">Delivered every 30 days · cancel anytime · ₹${item.price - displayPrice} extra savings per order</div>` : ""}
        ${item.prescriptionRequired ? '<span class="rx-chip">Rx Required</span>' : ""}
        <div style="margin-top:10px;">
          <button class="sub-add-btn ${isInBag(key) ? "added" : ""}" onclick="MC.addToBagFromCatalog('${item.id}')">
            ${isInBag(key) ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
    `;
  }

  function subCardHtml(original, s, isBest) {
    const mode = getMode(s.id);
    const displayPrice = computePrice(s.price, mode);
    const savings = original.price - displayPrice;
    const key = bagKey(s.id, mode);
    return `
      <div class="sub-card">
        <div style="flex:1;min-width:0;">
          <div class="product-name">${s.name}${isBest ? ' <span class="best-badge">Best Price</span>' : ""}</div>
          <div class="product-meta">${s.manufacturer} · ${s.packSize}</div>
          ${manufacturerTrustHtml(s.manufacturer)}
          ${purchaseToggleHtml(s.id, mode, true)}
          <div class="product-price-row">
            <span class="product-price">₹${displayPrice}</span>
            <span class="product-mrp">₹${s.mrp}</span>
            <span class="product-discount">${mode === "subscribe" ? "Extra 10% off" : s.discountPct + "% off"}</span>
          </div>
          ${savings > 0 ? `<span class="save-badge">Save ₹${savings} vs selected</span>` : ""}
          ${original.prescriptionRequired ? `<span class="match-badge">✓ Same constituent — prescription carries over</span>` : ""}
        </div>
        <button class="sub-add-btn ${isInBag(key) ? "added" : ""}" onclick="MC.addToBagFromSubstitute('${s.id}')">
          ${isInBag(key) ? "Added ✓" : "Add"}
        </button>
      </div>
    `;
  }

  function renderSubstitutes() {
    const item = MC_DATA.catalog.find(c => c.id === state.activeCatalogId);
    if (!item) return;
    document.getElementById("substitute-original").innerHTML = origCardHtml(item);

    const sorted = [...item.substitutes].sort((a, b) => a.price - b.price);
    const cheaper = sorted.filter(s => s.price < item.price);
    const bestId = cheaper.length ? cheaper[0].id : null;
    document.getElementById("substitute-list").innerHTML = sorted.map(s => subCardHtml(item, s, s.id === bestId)).join("");

    document.getElementById("substitute-consult").innerHTML = item.prescriptionRequired ? `
      <div class="consult-card">
        <div class="consult-ico">👨‍⚕️</div>
        <div class="consult-text">
          <div class="consult-title">Unsure about switching brands?</div>
          <div class="consult-sub">Talk to a doctor before choosing a substitute for this medicine.</div>
        </div>
        <button class="pill-btn outline" style="width:auto;padding:10px 16px;flex-shrink:0;" onclick="MC.demoConsult()">Book</button>
      </div>
    ` : "";
  }

  // ---------------- Bag ----------------

  function isInBag(key) {
    return state.bag.some(b => b.key === key);
  }

  // Personalized "still in your cart" nudge via MediBuddy — simulates the
  // "built a cart but didn't order for a few hours" signal on a short demo timer.
  function maybeScheduleCartReminder() {
    if (cartReminderTimer) clearTimeout(cartReminderTimer);
    if (state.bag.length === 0) {
      state.cartReminderReady = false;
      return;
    }
    cartReminderTimer = setTimeout(() => {
      state.cartReminderReady = true;
      state.agentSeen = false;
      renderAgentBubble();
      showToast("MediBuddy: you still have items waiting in your cart");
    }, 20000);
  }

  function addToBag(key, name, manufacturer, packSize, price, subscribed, prescriptionRequired) {
    const line = state.bag.find(b => b.key === key);
    if (line) line.qty++;
    else state.bag.push({
      key, name, manufacturer, packSize, price, qty: 1, subscribed,
      prescriptionRequired: !!prescriptionRequired,
      rxStatus: prescriptionRequired ? "none" : null,
    });

    updateBagBadge();
    showToast(
      prescriptionRequired ? name + " added · prescription required before checkout"
      : subscribed ? name + " added · Subscribe & Save"
      : name + " added to cart"
    );
    maybeScheduleCartReminder();

    if (document.getElementById("screen-substitutes").classList.contains("active")) renderSubstitutes();
    if (document.getElementById("screen-bag").classList.contains("active")) renderBag();
  }

  function addToBagFromCatalog(catalogId) {
    const item = MC_DATA.catalog.find(c => c.id === catalogId);
    if (!item) return;
    const mode = getMode(item.id);
    const price = computePrice(item.price, mode);
    addToBag(bagKey(item.id, mode), item.name, item.manufacturer, item.packSize, price, mode === "subscribe", item.prescriptionRequired);
  }

  function addToBagFromSubstitute(subId) {
    for (const c of MC_DATA.catalog) {
      const s = c.substitutes.find(sub => sub.id === subId);
      if (s) {
        const mode = getMode(s.id);
        const price = computePrice(s.price, mode);
        // Substitutes inherit the Rx requirement from the original — same
        // constituent, same legal/clinical requirement.
        addToBag(bagKey(s.id, mode), s.name, s.manufacturer, s.packSize, price, mode === "subscribe", c.prescriptionRequired);
        return;
      }
    }
  }

  function bagUploadPrescription(key) {
    const line = state.bag.find(b => b.key === key);
    if (!line) return;
    line.rxStatus = "uploaded";
    showToast("Prescription uploaded — pending pharmacist review");
    renderBag();
  }

  function bagRequestRxHelp(key) {
    const line = state.bag.find(b => b.key === key);
    if (!line) return;
    line.rxStatus = "help";
    showToast("A pharmacist will contact you about this item");
    renderBag();
  }

  function incBag(key) {
    const line = state.bag.find(b => b.key === key);
    if (line) line.qty++;
    updateBagBadge();
    renderBag();
  }

  function decBag(key) {
    const line = state.bag.find(b => b.key === key);
    if (!line) return;
    line.qty--;
    if (line.qty <= 0) state.bag = state.bag.filter(b => b.key !== key);
    updateBagBadge();
    maybeScheduleCartReminder();
    renderBag();
  }

  function updateBagBadge() {
    const count = state.bag.reduce((sum, b) => sum + b.qty, 0);
    const badge = document.getElementById("nav-bag-badge");
    badge.textContent = count;
    badge.classList.toggle("hide", count === 0);
  }

  function renderBag() {
    const wrap = document.getElementById("bag-contents");
    if (state.bag.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          <span class="e-ico">🛒</span>
          Your cart is empty.<br/>Browse medicines and substitutes to add them here.
          <div><button class="pill-btn outline" style="width:auto;padding:10px 20px;margin-top:16px;" onclick="MC.go('search')">Browse medicines</button></div>
        </div>
      `;
      return;
    }

    const subtotal = state.bag.reduce((sum, b) => sum + b.price * b.qty, 0);
    const delivery = deliveryCost();
    const total = subtotal + delivery;

    const rxItems = state.bag.filter(b => b.prescriptionRequired);
    const unresolved = rxItems.filter(b => b.rxStatus === "none").length;
    const pending = rxItems.filter(b => b.rxStatus === "uploaded" || b.rxStatus === "help").length;
    const rxBanner = rxItems.length ? `
      <div class="rx-banner">
        🩺 <b>Prescription Processing</b><br/>
        ${unresolved ? `${unresolved} item${unresolved !== 1 ? "s" : ""} need${unresolved === 1 ? "s" : ""} a prescription before checkout` : ""}
        ${unresolved && pending ? " · " : ""}
        ${pending ? `${pending} pending pharmacist review` : ""}
      </div>
    ` : "";

    wrap.innerHTML = `
      ${rxBanner}
      ${state.bag.map(b => `
        <div class="bag-line">
          <div class="bl-info">
            <div class="bl-name">${b.name}</div>
            <div class="bl-meta">${b.manufacturer} · ${b.packSize}${b.subscribed ? ' · <span class="sub-tag">🔁 Subscribe & Save</span>' : ""}</div>
            ${bagRxLineHtml(b)}
          </div>
          <div class="qty-control">
            <button onclick="MC.decBag('${b.key}')">−</button>
            <span>${b.qty}</span>
            <button onclick="MC.incBag('${b.key}')">+</button>
          </div>
          <div class="bl-price">₹${b.price * b.qty}</div>
        </div>
      `).join("")}
      <div class="section-label">Delivery speed <span class="section-new-tag">New</span></div>
      ${deliveryToggleHtml()}
      <div class="card cart-totals">
        <div class="ct-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
        <div class="ct-row"><span>Delivery</span><span>${delivery > 0 ? "₹" + delivery : "Free"}</span></div>
        <div class="ct-row total"><span>Total</span><span>₹${total.toLocaleString("en-IN")}</span></div>
      </div>
      ${unresolved
        ? `<p style="font-size:11.5px;color:var(--color-danger);text-align:center;margin:0 0 8px;">Resolve the prescription requirement${unresolved !== 1 ? "s" : ""} above to checkout</p>
           <button class="pill-btn solid" disabled style="opacity:0.5;cursor:not-allowed;">Checkout (Demo)</button>`
        : `<button class="pill-btn solid" onclick="MC.demoCheckout()">Checkout (Demo)</button>`}
    `;
  }

  function bagRxLineHtml(b) {
    if (!b.prescriptionRequired) return "";
    if (b.rxStatus === "none") {
      return `
        <div class="bag-rx-warning">⚠ Prescription required before checkout</div>
        <div class="bag-rx-actions">
          <button class="bag-rx-btn" onclick="MC.bagUploadPrescription('${b.key}')">Upload</button>
          <button class="bag-rx-btn" onclick="MC.bagRequestRxHelp('${b.key}')">Request help</button>
        </div>
      `;
    }
    if (b.rxStatus === "uploaded") return `<div class="bag-rx-pending">⏳ Pending pharmacist review</div>`;
    return `<div class="bag-rx-pending">🩺 Pharmacist will contact you</div>`;
  }

  function demoCheckout() {
    state.cartReminderReady = false;
    if (cartReminderTimer) clearTimeout(cartReminderTimer);
    showToast("This is a demo cart — see Smart Reorder for the full checkout flow");
  }

  // ---------------- Orders ----------------

  function renderOrders() {
    const list = [...state.placedOrders].reverse();
    document.getElementById("orders-list").innerHTML = list.map(o => `
      <div class="order-card" ${o.status === "Processing" ? `onclick="MC.go('trust')" style="cursor:pointer;"` : ""}>
        <div class="oc-top">
          <span class="oc-id">${o.id}</span>
          <span class="order-status-pill ${o.status}">${o.status}</span>
        </div>
        <div class="oc-meta">${o.date} · ${o.itemCount} medicine${o.itemCount !== 1 ? "s" : ""} · ₹${o.total.toLocaleString("en-IN")}${o.deliverySpeed === "express" ? " · ⚡ Express" : ""}</div>
        ${o.status === "Processing" ? `<div style="font-size:11.5px;color:var(--color-primary);font-weight:700;">Track order →</div>` : ""}
      </div>
    `).join("");
  }

  // ---------------- MediBuddy (proactive floating bubble) ----------------

  function renderAgentBubble() {
    document.getElementById("agent-bubble-dot").classList.toggle("hide", state.agentSeen);
  }

  function toggleAgentPanel() {
    const panel = document.getElementById("agent-panel");
    if (panel.classList.contains("open")) {
      closeAgentPanel();
      return;
    }
    renderAgentPanel();
    panel.classList.add("open");
    document.getElementById("agent-panel-backdrop").classList.add("open");
    state.agentSeen = true;
    renderAgentBubble();
  }

  function closeAgentPanel() {
    document.getElementById("agent-panel").classList.remove("open");
    document.getElementById("agent-panel-backdrop").classList.remove("open");
  }

  function agentItemRowHtml(item) {
    if (item.status === "ok" || item.decision) {
      const statusText = item.status === "ok" ? "✓ Ready" : (item.included ? "✓ Resolved" : "— Excluded");
      return `
        <div class="agent-item-row">
          <span class="agent-item-ico">💊</span>
          <div class="agent-item-text">
            <div class="agent-item-name">${item.name}</div>
            <div class="agent-item-status ok">${statusText}</div>
          </div>
        </div>
      `;
    }

    if (item.availability === "unavailable") {
      return `
        <div class="agent-item-row">
          <span class="agent-item-ico">💊</span>
          <div class="agent-item-text">
            <div class="agent-item-name">${item.name}</div>
            <div class="agent-item-status warn">⚠ Out of stock nearby</div>
            <div class="agent-reco-card">
              <div class="agent-reco-label">Recommended by MediBuddy</div>
              <div class="agent-reco-actions">
                <button class="agent-cta-btn" onclick="MC.agentResolveUnavailable('${item.id}','notify')">Notify me</button>
                <button class="agent-cta-btn" onclick="MC.agentResolveUnavailable('${item.id}','support')">Talk to pharmacist</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const subs = item.substitutes || [];
    return `
      <div class="agent-item-row">
        <span class="agent-item-ico">💊</span>
        <div class="agent-item-text">
          <div class="agent-item-name">${item.name}</div>
          <div class="agent-item-status warn">⚠ Needs prescription re-verification</div>
          ${subs.length ? `
            <div class="agent-reco-card">
              <div class="agent-reco-label">Same constituent (${item.constituent}) — ready now</div>
              ${subs.map(s => `
                <div class="agent-reco-sub">
                  <span>${s.name} · ₹${s.price}</span>
                  <button class="agent-cta-btn" onclick="MC.agentResolveSubstitute('${item.id}','${s.id}')">Use this</button>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  function restockAlertsHtml() {
    const readyAlerts = state.restockWatchlist
      .map(id => MC_DATA.catalog.find(c => c.id === id))
      .filter(item => item && item.inStock);
    if (!readyAlerts.length) return "";
    return `
      <div class="agent-section">
        <div class="section-label" style="margin-top:0;">📦 Restock alerts</div>
        ${readyAlerts.map(item => `
          <div class="restock-alert-card">
            <span class="ra-ico">💊</span>
            <div style="flex:1;min-width:0;">
              <div class="ra-name">${item.name}</div>
              <div class="ra-status">✓ Back in stock — ₹${item.price}</div>
              <div class="agent-reco-actions">
                <button class="agent-cta-btn" onclick="MC.agentAddRestockedToBag('${item.id}')">Add to Cart</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function cartReminderHtml() {
    if (!state.cartReminderReady || state.bag.length === 0) return "";
    const count = state.bag.reduce((sum, b) => sum + b.qty, 0);
    return `
      <div class="agent-section">
        <div class="section-label" style="margin-top:0;">🛒 Still in your cart</div>
        <div class="cart-reminder-card">
          <div class="cr-label">Personalized reminder from MediBuddy</div>
          <div class="cr-body">You added ${count} item${count !== 1 ? "s" : ""} a little while ago but haven't checked out yet.</div>
          <div class="agent-reco-actions">
            <button class="agent-cta-btn" onclick="MC.closeAgentPanel();MC.go('bag')">Go to Cart</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderAgentPanel() {
    const attention = state.items.filter(i => i.status === "attention" && !i.decision);
    const readyCount = state.items.length - attention.length;

    const body = document.getElementById("agent-panel-body");
    body.innerHTML = `
      <p class="agent-intro">✨ New: AI-powered restock is ready. I checked your next refill in the background — here's what I found.</p>
      ${restockAlertsHtml()}
      ${cartReminderHtml()}
      <div class="agent-section">
        <div class="section-label" style="margin-top:0;">💊 Your next refill</div>
        <div class="agent-summary-row">
          <span class="ok-count">${readyCount} ready</span>
          <span class="warn-count">${attention.length} need your input</span>
        </div>
        ${state.items.map(agentItemRowHtml).join("")}
      </div>
      <button class="pill-btn solid" onclick="MC.closeAgentPanel();MC.go('reorder')">Review full order</button>
    `;
  }

  function agentResolveUnavailable(itemId, optionId) {
    const item = state.items.find(i => i.id === itemId);
    const opt = MC_DATA.recoveryOptions.unavailable.find(o => o.id === optionId);
    if (!item || !opt) return;
    applyUnavailableResolution(item, opt);
    showToast(`${item.name}: ${opt.label}`);
    renderAgentPanel();
  }

  function agentResolveSubstitute(itemId, subId) {
    const item = state.items.find(i => i.id === itemId);
    const sub = (item.substitutes || []).find(s => s.id === subId);
    if (!item || !sub) return;
    applySubstituteResolution(item, sub);
    showToast(`Switched to ${sub.name}`);
    renderAgentPanel();
  }

  // Out-of-stock search item → MediBuddy notifies when it's restocked.
  function watchRestock(catalogId) {
    if (!state.restockWatchlist.includes(catalogId)) state.restockWatchlist.push(catalogId);
    showToast("We'll notify you via MediBuddy when it's back in stock");
    renderSubstitutes();

    const item = MC_DATA.catalog.find(c => c.id === catalogId);
    if (!item) return;
    setTimeout(() => {
      item.inStock = true;
      state.agentSeen = false;
      renderAgentBubble();
      showToast(`MediBuddy: ${item.name} is back in stock!`);
      if (document.getElementById("screen-substitutes").classList.contains("active") && state.activeCatalogId === catalogId) {
        renderSubstitutes();
      }
    }, 12000);
  }

  function agentAddRestockedToBag(catalogId) {
    addToBagFromCatalog(catalogId);
    state.restockWatchlist = state.restockWatchlist.filter(id => id !== catalogId);
    renderAgentPanel();
  }

  function demoConsult() {
    showToast("Demo: doctor consultation booking would open here");
  }

  // ---------------- Toast ----------------

  function showToast(msg) {
    const t = document.getElementById("app-toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    go, openCategory,
    startExceptionFlow, selectUnavailableOption, confirmUnavailableChoice,
    uploadPrescriptionDemo, requestHelp, confirmPrescriptionChoice, selectPrescriptionSubstitute,
    placeOrder, toggleDelay, restart, setDeliverySpeed,
    setCategory, onSearchInput, openProduct, searchFromHistory, clearHistory,
    setPurchaseMode,
    addToBagFromCatalog, addToBagFromSubstitute, incBag, decBag, demoCheckout,
    bagUploadPrescription, bagRequestRxHelp,
    toggleAgentPanel, closeAgentPanel, agentResolveUnavailable, agentResolveSubstitute,
    watchRestock, agentAddRestockedToBag, demoConsult,
  };
})();
